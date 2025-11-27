
/* ----------------------------
   Inline styles (simple)
   ---------------------------- */
const styles = {
  container: {
    fontFamily: "Inter, Arial, sans-serif",
    padding: 16,
    height: "100vh",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "#f6f8fb",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#0b63d6",
    color: "white",
    border: "1px solid #094fa9",
    borderRadius: 8,
    cursor: "pointer",
  },
  topRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  filesColumn: {
    width: 420,
    background: "white",
    padding: 12,
    borderRadius: 8,
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },
  tabsRow: {
    flex: 1,
    background: "transparent",
    display: "flex",
    alignItems: "center",
    paddingLeft: 6,
    minHeight: 90,
  },
  tabsContainer: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "6px 8px",
  },
  chromeTab: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 8,
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
    cursor: "pointer",
    userSelect: "none",
  },
  main: {
    display: "flex",
    gap: 12,
    flex: 1,
    minHeight: 0, // allow children to scroll
  },
  editor: {
    width: 420,
    background: "white",
    padding: 14,
    borderRadius: 8,
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
    overflow: "hidden",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sectionTitle: {
    fontWeight: 700,
    marginBottom: 10
  },
  textInput: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #ddd",
    boxSizing: "border-box",
  },
  textInputArea: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  previewArea: {
    position: "relative",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  actionsRow: {
    display: "flex",
    gap: 10,
  },
  previewBox: {
    flex: 1,
    background: "white",
    borderRadius: 8,
    padding: 16,
    overflow: "auto",
    border: "1px solid #e6eef9",
    display: "flex",
    justifyContent: "center",
  },
  logo: {
    position: "absolute",
    top: 10,
    right: 20,
  },
};

export default styles