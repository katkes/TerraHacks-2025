import StoryForm from "./components/StoryForm";

function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <StoryForm />
      
      <hr style={{ margin: '2rem 0' }} />
      
    </div>
  );
}

export default App;