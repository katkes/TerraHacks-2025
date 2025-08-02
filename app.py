import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
import uuid

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

app = Flask(__name__)

try:
    client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
    client.admin.command('ping')
    print("Pinged your deployment. Successfully connected to MongoDB Atlas!")
    db = client.get_database("constellationDB")
    storiesCollection = db.stories
except Exception as e:
    print(f"MongoDB connection error: {e}")
    exit(1)

# API Endpoints

@app.route('/submit-story', methods=['POST'])
def submitStory():
    data = request.json
    alias = data.get('alias', 'Anonymous')
    storyText = data.get('storyText')
    insightText = data.get('insightText')
    themes = data.get('themes', [])

    if not storyText or not insightText:
        return jsonify({"error": "Story and insight text are required."}), 400
    if not isinstance(themes, list):
        return jsonify({"error": "Themes must be provided as a list."}), 400
    
    storyId = f"STORY-{uuid.uuid4().hex[:8].upper()}"

    newStoryDoc = {
        "storyId": storyId,
        "alias": alias,
        "storyText": storyText,
        "insightText": insightText,
        "themes": themes
    }

    try:
        storiesCollection.insert_one(newStoryDoc)
        return jsonify({
            "message": "Story submitted successfully!",
            "storyId": storyId,
        }), 200
    except Exception as e:
        return jsonify({"error": "Failed to save story to database."}), 500

@app.route('/get-story/<storyId>', methods=['GET'])
def getStoryDetails(storyId):
    try:
        storyDoc = storiesCollection.find_one({"storyId": storyId})
        if storyDoc:
            storyDoc['_id'] = str(storyDoc['_id'])
            return jsonify(storyDoc), 200
        return jsonify({"error": "Story not found."}), 404
    except Exception as e:
        return jsonify({"error": "Failed to retrieve story details."}), 500
    
@app.route('/get-graph-data', methods=['GET'])
def get_graph_data():
    try:
        # Fetch all documents from the 'stories' collection
        all_stories_cursor = storiesCollection.find({})
        all_stories_list = list(all_stories_cursor)

        nodes = []
        links = []
        
        # Helper maps to build connections and topMatch efficiently
        story_themes_map = {} # storyId -> set of themes
        # Stores {source_id: {target_id: strength_score, ...}}
        story_connections_strength = {} 

        # 1. Populate 'story_themes_map' and initialize 'story_connections_strength'
        for story_doc in all_stories_list:
            story_id = story_doc.get('storyId')
            story_themes_map[story_id] = set(story_doc.get('themes', []))
            story_connections_strength[story_id] = {}

        for i in range(len(all_stories_list)):
            story1 = all_stories_list[i]
            story1_id = story1.get('storyId')
            themes1 = story_themes_map.get(story1_id, set())

            # Inner loop starts from i + 1 to avoid self-connection and duplicate pairs
            for j in range(i + 1, len(all_stories_list)):
                story2 = all_stories_list[j]
                story2_id = story2.get('storyId')
                themes2 = story_themes_map.get(story2_id, set())

                common_themes = themes1.intersection(themes2)

                # Link condition: at least 2 common themes
                if len(common_themes) >= 2:
                    # Calculate a simple strength score (can be refined)
                    # max(..., 1) prevents division by zero if a story has no themes
                    strength = len(common_themes) / max(len(themes1), len(themes2))
                    
                    # Store strength for both directions to find topMatch later
                    story_connections_strength[story1_id][story2_id] = strength
                    story_connections_strength[story2_id][story1_id] = strength

        preprocessed_links = set()
        # 3. Populate 'nodes' array with the desired 'data' structure and 'topMatches'
        for story_doc in all_stories_list:
            story_id = story_doc.get('storyId')

            sorted_matches = sorted(story_connections_strength.get(story_id, {}).items(), key=lambda x: x[1], reverse=True)[:3]
            
            for match_id, _ in sorted_matches:
                if (story_id, match_id) in preprocessed_links or (match_id, story_id) in preprocessed_links:
                    continue
                preprocessed_links.add((story_id, match_id))
                links.append({
                    "source": story_id,
                    "target": match_id
                })

            nodes.append({
                "id": story_id,
                "data": {
                    "alias": story_doc.get('alias', 'Anonymous'),
                    "storyText": story_doc.get('storyText', ''),
                    "insightText": story_doc.get('insightText', '')
                }
            })
        
        # Return the final JSON structure
        return jsonify({"nodes": nodes, "links": links}), 200

    except Exception as e:
        return jsonify({"error": "Failed to retrieve graph data."}), 500
    
@app.route('/search-story', methods=['GET'])
def search_story():
    """
    Handles search queries, performing an exact, case-insensitive match on 'alias'.
    Returns the 'storyId's of matching nodes for the frontend to highlight on the graph.
    """
    query = request.args.get('q', '').strip() 
    if not query:
        return jsonify({"matched_ids": [], "message": "Please provide an alias to search for."}), 200

    matched_ids = []

    try:
        # Perform an exact, case-insensitive match on the 'alias' field
        # '$regex': f"^{query}$" ensures a full string match (from start ^ to end $)
        # '$options': 'i' makes the search case-insensitive
        matching_stories_cursor = storiesCollection.find(
            {"alias": {"$regex": f"^{query}$", "$options": "i"}}
        )
        
        found_stories = list(matching_stories_cursor)
        
        if found_stories:
            matched_ids.extend([s.get('storyId') for s in found_stories])
        
    except Exception as e:
        return jsonify({"error": "An error occurred during search."}), 500

    return jsonify({"matched_ids": matched_ids}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)