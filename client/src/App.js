import StoryForm from "./StoryForm";
import { StylizedButton } from "./components/StylizedButton";
// import { VoiceChat } from "./components/VoiceChat";

function App() {
  return (
    <div className="App">
      <StylizedButton>TEST BUTTON</StylizedButton>
      <h1 className="text-2xl font-bold my-4 text-center">Story Themes</h1>
      <StoryForm />
      
      <hr style={{ margin: '2rem 0' }} />
      
      {/* <VoiceChat /> */}
    </div>
  );
}

export default App;