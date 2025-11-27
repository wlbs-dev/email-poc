import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { FaPlus, FaDownload, FaTimes, FaRegFileAlt } from "react-icons/fa";
import styles from "../Styles/home";

export default function ZipHtmlEditor() {
    useEffect(() => {
        document.title = "Zip HTML Editor";

        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = ""; // required for Chrome
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);
    const [zip, setZip] = useState(null);
    const [htmlFiles, setHtmlFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);

    const [tabs, setTabs] = useState([]);
    const [activeIdx, setActiveIdx] = useState(null);

    const rawHtmlRef = useRef("");
    const imageMap = useRef({});

    // ------------------ MODALS ------------------
    const [showInputModal, setShowInputModal] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);

    const [inputValue, setInputValue] = useState("");
    const [alertMessage, setAlertMessage] = useState("");

    const openInputModal = () => {
        setInputValue("");
        setShowInputModal(true);
    };

    const closeInputModal = () => setShowInputModal(false);

    const openAlert = (msg) => {
        setAlertMessage(msg);
        setShowAlertModal(true);
    };

    const closeAlert = () => setShowAlertModal(false);

    // ------------------ 1. Upload ZIP ------------------
    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const jszip = await JSZip.loadAsync(file);
        setZip(jszip);

        const foundHtml = [];
        const imgMap = {};
        const imagePromises = [];

        jszip.forEach((path, fileRef) => {
            if (path.endsWith(".html")) foundHtml.push(path);

            if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(path)) {
                imagePromises.push(
                    fileRef.async("blob").then((blob) => {
                        imgMap[path] = URL.createObjectURL(blob);
                    })
                );
            }
        });

        await Promise.all(imagePromises);
        imageMap.current = imgMap;
        setHtmlFiles(foundHtml);

        setSelectedFile(null);
        rawHtmlRef.current = "";
        setTabs([]);
        setActiveIdx(null);

        openAlert("ZIP Loaded Successfully, Please select an HTML file to begin.");
    };

    // ------------------ 2. Load HTML ------------------
    const loadHtml = async (fileName) => {
        if (!zip) return;

        const fileRef = zip.file(fileName);
        if (!fileRef) return;

        const html = await fileRef.async("text");
        rawHtmlRef.current = html;
        setSelectedFile(fileName);

        setTabs([]);
        setActiveIdx(null);

        openAlert(`<div style="
    background: #f8faff;
    border: 1px solid #d8e6ff;
    padding: 16px 20px;
    border-radius: 10px;
    font-size: 15px;
    line-height: 1.5;
    color: #234;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
">
    <div style="
        font-weight: 600;
        margin-bottom: 6px;
        color: #1e88ff;
        font-size: 16px;
    ">
        Loaded HTML File
    </div>

    <div style="margin-bottom: 8px;">
        <strong style="color: #333;">${fileName.split("/").pop()}</strong>
    </div>

    <div style="color: #555;">
        Create tabs to edit text content.
    </div>
</div>`);
    };

    // ------------------ 3. Create Tab ------------------
    const createTab = () => {
        if (!selectedFile) {
            openAlert("Load an HTML file first.");
            return;
        }
        openInputModal(); // open modal instead of prompt
    };

    const confirmCreateTab = () => {
        const name = inputValue.trim();
        if (!name) {
            openAlert("Tab name cannot be empty.");
            return;
        }
        closeInputModal();

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtmlRef.current, "text/html");

        const htmlDir = selectedFile.split("/").slice(0, -1).join("/");

        doc.querySelectorAll("img").forEach((img) => {
            const originalSrc = img.getAttribute("src");
            if (!originalSrc) return;

            img.dataset.originalSrc = originalSrc;

            let normalized = originalSrc.replace(/^\.\//, "");

            if (htmlDir) {
                const combined = htmlDir + "/" + normalized;
                const parts = combined.split("/");
                const clean = [];
                for (let p of parts) {
                    if (p === "..") clean.pop();
                    else if (p !== ".") clean.push(p);
                }
                normalized = clean.join("/");
            }

            if (imageMap.current[normalized]) {
                img.src = imageMap.current[normalized];
            }
        });

        const extracted = [];
        let idCounter = 1;

        const walker = document.createTreeWalker(
            doc.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    return node.textContent.trim().length
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                },
            }
        );

        let node;
        while ((node = walker.nextNode())) {
            extracted.push({
                id: idCounter++,
                original: node.textContent,
                updated: node.textContent,
                nodeRef: node,
            });
        }

        const newTab = {
            id: Date.now(),
            name,
            doc,
            textNodes: extracted,
            previewHtml: doc.body.innerHTML,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveIdx(tabs.length);

        openAlert(`Tab "${name}" created, you can now edit the text content.`);
    };

    // ------------------ 4. Update Text ------------------
    const updateText = (tabIndex, textId, newValue) => {
        setTabs((prevTabs) => {
            const copy = prevTabs.map((t) => ({ ...t }));
            const tab = copy[tabIndex];
            if (!tab) return prevTabs;

            tab.textNodes = tab.textNodes.map((item) =>
                item.id === textId ? { ...item, updated: newValue } : item
            );

            tab.textNodes.forEach((item) => {
                try {
                    item.nodeRef.textContent = item.updated;
                } catch { }
            });

            tab.previewHtml = tab.doc.body.innerHTML;
            return copy;
        });
    };

    // ------------------ 5. Save Tab ------------------
    const saveTabToZip = (idx) => {
        if (!zip) return;

        const tab = tabs[idx];
        if (!tab) return;

        tab.textNodes.forEach((t) => {
            try {
                t.nodeRef.textContent = t.updated;
            } catch { }
        });

        tab.doc.querySelectorAll("img").forEach((img) => {
            if (img.dataset.originalSrc) img.src = img.dataset.originalSrc;
        });

        const finalHtml = tab.doc.documentElement.outerHTML;
        zip.file(selectedFile, finalHtml);

        restorePreviewImages(tab);

        setTabs([...tabs]);
    };

    const restorePreviewImages = (tab) => {
        const htmlDir = selectedFile.split("/").slice(0, -1).join("/");

        tab.doc.querySelectorAll("img").forEach((img) => {
            const originalSrc = img.dataset.originalSrc;
            if (!originalSrc) return;

            let normalized = originalSrc.replace(/^\.\//, "");
            if (htmlDir) {
                const combined = htmlDir + "/" + normalized;
                const parts = combined.split("/");
                const clean = [];
                for (let p of parts) {
                    if (p === "..") clean.pop();
                    else if (p !== ".") clean.push(p);
                }
                normalized = clean.join("/");
            }

            if (imageMap.current[normalized]) {
                img.src = imageMap.current[normalized];
            }
        });

        tab.previewHtml = tab.doc.body.innerHTML;
    };

    // ------------------ 6. Export Tab ------------------
    const exportActiveTab = async (idx) => {
        if (!zip) {
            openAlert("No ZIP loaded.");
            return;
        }

        const tab = tabs[idx];
        if (!tab) return;

        saveTabToZip(idx);

        const blob = await zip.generateAsync({ type: "blob" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);

        const safeName = tab.name.replace(/\s+/g, "_").replace(/[^\w\-_.]/g, "");
        a.download = `${safeName}.zip`;
        a.click();
    };

    // ------------------ 7. Close Tab ------------------
    const closeTab = (idx, e) => {
        e?.stopPropagation();
        setTabs((prev) => {
            const copy = [...prev];
            copy.splice(idx, 1);
            return copy;
        });

        setActiveIdx((prevIdx) => {
            if (prevIdx === null) return null;
            if (idx < prevIdx) return prevIdx - 1;
            if (idx === prevIdx) {
                const newCount = Math.max(0, tabs.length - 1);
                if (newCount === 0) return null;
                if (idx - 1 >= 0) return idx - 1;
                return 0;
            }
            return prevIdx;
        });
    };

    const activeTabObj = activeIdx !== null && tabs[activeIdx] ? tabs[activeIdx] : null;


    // ------------------ UI ------------------
    return (
        <div style={styles.container}>

            {/* CUSTOM MODALS */}
            {showInputModal && (
                <div style={modalOverlay}>
                    <div style={modalBox}>
                        <div style={modalHeader}>
                            <h3 style={{ margin: 0, fontSize: 20 }}>Create New Tab</h3>
                            <FaTimes style={modalClose} onClick={closeInputModal} />
                        </div>

                        <div style={modalBody}>
                            <label style={modalLabel}>Tab Name</label>
                            <input
                                style={modalInput}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Enter a descriptive tab name"
                            />
                        </div>

                        <div style={modalFooter}>
                            <button style={modalBtnSecondary} onClick={closeInputModal}>Cancel</button>
                            <button style={modalBtnPrimary} onClick={confirmCreateTab}>Create</button>
                        </div>
                    </div>
                </div>
            )}


            {(showAlertModal) && (
                <div style={modalOverlay}>
                    <div style={modalBox}>
                        <div style={modalHeader}>
                            <FaTimes style={modalClose} onClick={closeAlert} />
                        </div>

                        <div style={{ textAlign: "center", margin: "40px", fontSize: "20px" }} dangerouslySetInnerHTML={{ __html: alertMessage }} />

                        <div style={modalFooter}>
                            <button style={modalBtnPrimaryAlert} onClick={closeAlert}>OK</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rest of YOUR UI (unchanged) */}
            <div style={styles.logo}>
                <img src="/logo.png" alt="Logo" style={{ height: 140 }} />
            </div>

            <div style={styles.header}>
                <input type="file" accept=".zip" onChange={handleUpload} />
                <button style={styles.primaryBtn} onClick={createTab}>
                    <FaPlus style={{ marginRight: 8 }} /> Add Tab
                </button>
            </div>

            <div style={styles.topRow}>
                {/* File list */}
                <div style={styles.filesColumn}>
                    <div style={styles.sectionTitle}>HTML Files</div>
                    {htmlFiles.map((f) => (
                        <div
                            key={f}
                            onClick={() => loadHtml(f)}
                            style={{
                                ...styles.fileItem,
                                background: selectedFile === f ? "#e6f0ff" : "white",
                            }}
                        >
                            <FaRegFileAlt style={{ marginRight: 8 }} />
                            {f}
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={styles.tabsRow}>
                    {tabs.map((t, i) => (
                        <div
                            key={t.id}
                            onClick={() => setActiveIdx(i)}
                            style={{
                                ...styles.chromeTab,
                                background: activeIdx === i ? "white" : "#f3f6fb",
                                borderBottom: activeIdx === i ? "2px solid #1e88ff" : "2px solid transparent",
                            }}
                        >
                            <span>{t.name}</span>
                            <FaTimes
                                style={{ marginLeft: 8, cursor: "pointer" }}
                                onClick={(e) => closeTab(i, e)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div style={styles.main}>
                {/* Left: Text */}
                <div style={styles.editor}>
                    <div style={styles.sectionTitle}>Editable Text Content</div>

                    {activeTabObj &&
                        activeTabObj.textNodes.map((item) => (
                            <div key={item.id} style={styles.textInputArea}>
                                <div>Original</div>
                                <div>{item.original}</div>
                                {item.original.length < 70 ? <input
                                    type="text"
                                    value={item.updated}
                                    onChange={(e) => updateText(activeIdx, item.id, e.target.value)}
                                    style={styles.textInput}
                                /> : <textarea
                                    type="text"
                                    rows={5}
                                    value={item.updated}
                                    onChange={(e) => updateText(activeIdx, item.id, e.target.value)}
                                    style={styles.textInput} />}
                            </div>
                        ))}
                </div>

                {/* Right: Preview */}
                <div style={styles.previewArea}>
                    <button
                        style={{
                            ...styles.primaryBtn,
                            background: "#28a745",
                            borderColor: "#23823a",
                            position: "absolute",
                            zIndex: 10,
                            top: 20,
                            right: 20,
                        }}
                        disabled={!activeTabObj}
                        onClick={() => exportActiveTab(activeIdx)}
                    >
                        <FaDownload style={{ marginRight: 8 }} /> Export
                    </button>

                    <div className="previewBoxRef" style={styles.previewBox}>
                        {activeTabObj ? (
                            <div
                                id="scaledPreview"
                                style={{
                                    transformOrigin: "top left",
                                    width: "fit-content",
                                    height: "fit-content",
                                }}
                                dangerouslySetInnerHTML={{ __html: activeTabObj.previewHtml }}
                            />
                        ) : (
                            "No preview"
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}


/* ------------------ MODAL STYLES ------------------ */

const modalOverlay = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
};

const modalBox = {
    position: "relative",
    width: 400,
    background: "#fff",
    padding: 36,
    borderRadius: 12,
    boxShadow: "0 4px 18px rgba(0,0,0,0.2)",
    overflow: "hidden",
    animation: "fadeIn 0.2s ease",
};

const modalHeader = {
    margin: "16px 0px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
};

const modalBody = {
    position: "relative",
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
};

const modalLabel = {
    fontWeight: 600,
    fontSize: 14,
};

const modalInput = {
    width: "80%",
    padding: "10px",
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 14,
    outline: "none",
};

const modalFooter = {
    marginTop: 22,
    display: "flex",
    justifyContent: "flex-start",
    gap: 10,
};

const modalBtnPrimaryAlert = {
    padding: "8px 18px",
    width: "100%",
    height: 36,
    background: "#1e88ff",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
}

const modalBtnPrimary = {
    padding: "8px 18px",
    width: "45%",
    height: 36,
    background: "#1e88ff",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
};

const modalBtnSecondary = {
    padding: "8px 18px",
    background: "#e9ecef",
    color: "#333",
    width: "45%",
    height: 36,
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
};

const modalClose = {
    position: "absolute",
    top: 16,
    right: 16,
    cursor: "pointer",
    fontSize: 28,
    color: "#666",
};