export const StylizedButton = ({ children, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        background: "rgba(255, 255, 255, 0.27)",
        color: "#222",
        padding: "0.75rem 2rem",
        border: "1px solid rgba(180,180,190,0.25)",
        borderRadius: "16px",
        fontWeight: 600,
        fontSize: "1.1rem",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
        cursor: "pointer",
        transition: "transform 0.08s, box-shadow 0.08s, background 0.2s",
        outline: "none",
        letterSpacing: "0.05em",
        margin: "0.5rem 0",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #cbd5e1")}
      onBlur={(e) =>
        (e.currentTarget.style.boxShadow = "0 4px 30px rgba(0, 0, 0, 0.1)")
      }
    >
      <span
        style={{
          position: "relative",
          zIndex: 2,
        }}
      >
        {children}
      </span>
      <span
        aria-hidden
        style={{
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, rgba(200,200,210,0.10) 100%)",
          zIndex: 1,
          borderRadius: "16px",
        }}
      />
    </button>
  );
};
