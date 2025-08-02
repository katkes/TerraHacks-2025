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
    name = data.get('name', 'Anonymous')
    storyText = data.get('storyText')
    insightText = data.get('insightText')

    if not storyText or not insightText:
        return jsonify({"error": "Story and insight text are required."}), 400
    
    storyId = f"STORY-{uuid.uuid4().hex[:8].upper()}"

    newStoryDoc = {
        "storyId": storyId,
        "name": name,
        "storyText": storyText,
        "insightText": insightText
    }

    try:
        storiesCollection.insert_one(newStoryDoc)
        print(f"Story {storyId} inserted into MongoDB.")
        return jsonify({
            "message": "Story submitted successfully!",
            "storyId": storyId,
            "alias": name
        }), 201
    except Exception as e:
        print(f"Error inserting story into MongoDB: {e}")
        return jsonify({"error": "Failed to save story to database."}), 500

@app.route('/get-story/<story_id>', methods=['GET'])
def getStoryDetails(storyId):
    try:
        storyDoc = storiesCollection.find_one({"storyId": storyId})
        if storyDoc:
            storyDoc['_id'] = str(storyDoc['_id'])
            return jsonify(storyDoc), 200
        return jsonify({"error": "Story not found."}), 404
    except Exception as e:
        print(f"Error fetching story {storyId} details: {e}")
        return jsonify({"error": "Failed to retrieve story details."}), 500