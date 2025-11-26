import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { FaPlus, FaSave, FaDownload, FaTimes, FaRegFileAlt } from "react-icons/fa";
import styles from "../Styles/home"

export default function ZipHtmlEditor() {
    const [zip, setZip] = useState(null);
    const [htmlFiles, setHtmlFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);

    // tabs: [{ id, name, doc, textNodes, previewHtml }]
    const [tabs, setTabs] = useState([]);
    const [activeIdx, setActiveIdx] = useState(null);

    const rawHtmlRef = useRef(""); // original HTML text (from loaded file)
    const imageMap = useRef({}); // map path -> blob url for preview

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
        // reset selection/tabs
        setSelectedFile(null);
        rawHtmlRef.current = "";
        setTabs([]);
        setActiveIdx(null);
    };

    // ------------------ 2. Load HTML (store rawHtml, prepare base doc for cloning) ------------------
    const loadHtml = async (fileName) => {
        if (!zip) return;
        const fileRef = zip.file(fileName);
        if (!fileRef) return;

        const html = await fileRef.async("text");
        rawHtmlRef.current = html;
        setSelectedFile(fileName);

        // clear existing tabs when user loads a different file
        setTabs([]);
        setActiveIdx(null);
    };

    // ------------------ 3. Create Tab (clone original HTML + apply image preview logic exactly) ------------------
    const createTab = () => {
        if (!selectedFile) {
            alert("Load an HTML file first (click one from HTML Files).");
            return;
        }
        const name = prompt("Enter tab name:", `Tab ${tabs.length + 1}`);
        if (!name) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtmlRef.current, "text/html");

        // Fix image preview (preserve exact logic: store original src in data-original-src, then substitute blob URL for preview only)
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
                img.src = imageMap.current[normalized]; // preview blob only
            }
        });

        // Extract text nodes (same method you used)
        const extracted = [];
        let idCounter = 1;
        const walker = document.createTreeWalker(
            doc.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    return node.textContent.trim().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
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
        setActiveIdx((prev) => {
            const idx = tabs.length; // new tab will be at end
            return idx;
        });
    };

    // ------------------ 4. Update text in active tab ------------------
    const updateText = (tabIndex, textId, newValue) => {
        setTabs((prevTabs) => {
            const copy = prevTabs.map((t) => ({ ...t }));
            const tab = copy[tabIndex];
            if (!tab) return prevTabs;

            tab.textNodes = tab.textNodes.map((item) => (item.id === textId ? { ...item, updated: newValue } : item));

            // update DOM nodeRefs in tab.doc
            tab.textNodes.forEach((item) => {
                try {
                    item.nodeRef.textContent = item.updated;
                } catch (e) {
                    // if nodeRef is stale for some reason, ignore
                }
            });

            tab.previewHtml = tab.doc.body.innerHTML;
            return copy;
        });
    };

    // ------------------ 5. Save one tab into in-memory zip (restore images before writing) ------------------
    const saveTabToZip = (idx) => {
        if (!zip) return;

        const tab = tabs[idx];
        if (!tab) return;

        // Update text
        tab.textNodes.forEach(t => {
            try { t.nodeRef.textContent = t.updated; } catch { }
        });

        // Restore original image src before saving
        tab.doc.querySelectorAll("img").forEach((img) => {
            if (img.dataset.originalSrc) img.src = img.dataset.originalSrc;
        });

        // Save HTML into zip
        const finalHtml = tab.doc.documentElement.outerHTML;
        zip.file(selectedFile, finalHtml);

        // 🔥 Important: restore blob preview for UI
        restorePreviewImages(tab);

        setTabs([...tabs]); // update state
        alert(`Saved tab "${tab.name}"`);
    };


    const restorePreviewImages = (tab) => {
        const htmlDir = selectedFile.split("/").slice(0, -1).join("/");

        tab.doc.querySelectorAll("img").forEach((img) => {
            const originalSrc = img.dataset.originalSrc;
            if (!originalSrc) return;

            // rebuild normalized path
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

            // restore Blob preview URL
            if (imageMap.current[normalized]) {
                img.src = imageMap.current[normalized];
            }
        });

        tab.previewHtml = tab.doc.body.innerHTML;
    };


    // ------------------ 6. Export only active tab (download ZIP with that tab's HTML) ------------------
    const exportActiveTab = async (idx) => {
        if (!zip) {
            alert("No ZIP loaded.");
            return;
        }
        const tab = tabs[idx];
        if (!tab) return;

        // Save into zip first (restores original image src before writing)
        saveTabToZip(idx);

        // generate blob and download
        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        // sanitize filename
        const safeName = tab.name.replace(/\s+/g, "_").replace(/[^\w\-_.]/g, "");
        a.download = `${safeName}.zip`;
        a.click();
    };

    // ------------------ 7. Close tab ------------------
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
                // pick previous tab if exists, else next, else null
                const newCount = Math.max(0, tabs.length - 1);
                if (newCount === 0) return null;
                if (idx - 1 >= 0) return idx - 1;
                return 0;
            }
            return prevIdx;
        });
    };

    // small helper to render sanitized text preview (no change to user's logic)
    const activeTabObj = activeIdx !== null && tabs[activeIdx] ? tabs[activeIdx] : null;

    // ---------- UI ----------
    return (
        <div style={styles.container}>
            <div style={styles.logo}>
                <img src="/logo.png" alt="Logo" style={{ height: 140 }} />
            </div>
            {/* Header */}
            <div style={styles.header}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="file" accept=".zip" onChange={handleUpload} />
                    <div style={{ display: "flex", gap: 8 }}>
                        <button style={styles.primaryBtn} onClick={createTab}>
                            <FaPlus style={{ marginRight: 8 }} />
                            Add Tab
                        </button>
                    </div>
                </div>

                <div style={{ marginLeft: "auto", color: "#666" }}>
                    {selectedFile ? <span>Loaded: <strong>{selectedFile}</strong></span> : <span style={{ fontStyle: "italic" }}>No HTML loaded</span>}
                </div>
            </div>

            {/* Files + tabs row */}
            <div style={styles.topRow}>
                {/* Files list */}
                <div style={styles.filesColumn}>
                    <div style={styles.sectionTitle}>HTML Files</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {htmlFiles.length === 0 && <div style={{ color: "#777" }}>No HTML files in ZIP</div>}
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
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div style={styles.tabsRow}>
                    {tabs.length === 0 ? (
                        <div style={{ padding: 12, color: "#666" }}>No tabs yet — create a tab to start editing.</div>
                    ) : (
                        <div style={styles.tabsContainer}>
                            {tabs.map((t, i) => (
                                <div
                                    key={t.id}
                                    onClick={() => setActiveIdx(i)}
                                    style={{
                                        ...styles.chromeTab,
                                        background: activeIdx === i ? "white" : "#f3f6fb",
                                        borderBottom: activeIdx === i ? "2px solid #1e88ff" : "2px solid transparent",
                                        color: activeIdx === i ? "#0b63d6" : "#333",
                                    }}
                                >
                                    <span style={{ marginRight: 10 }}>{t.name}</span>
                                    <FaTimes
                                        style={{ cursor: "pointer" }}
                                        onClick={(e) => closeTab(i, e)}
                                        title="Close tab"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main area: left editor list, right preview */}
            <div style={styles.main}>
                {/* Editor panel */}
                <div style={styles.editor}>
                    <div style={styles.sectionTitle}>Editable Text Content</div>
                    {!activeTabObj && <div style={{ color: "#777", padding: 12 }}>Select a tab to edit its text</div>}

                    {activeTabObj && (
                        <div style={{ maxHeight: "72vh", overflowY: "auto", paddingRight: 8 }}>
                            {activeTabObj.textNodes.map((item) => (
                                <div key={item.id} style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 13, color: "#444", marginBottom: 6, fontWeight: 600 }}>Original</div>
                                    <div style={{ marginBottom: 6, color: "#333" }}>{item.original}</div>

                                    <input
                                        type="text"
                                        value={item.updated}
                                        onChange={(e) => updateText(activeIdx, item.id, e.target.value)}
                                        style={styles.textInput}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Preview & actions */}
                <div style={styles.previewArea}>
                    <div style={styles.actionsRow}>
                        <button
                            style={styles.primaryBtn}
                            disabled={!activeTabObj}
                            onClick={() => activeIdx !== null && saveTabToZip(activeIdx)}
                        >
                            <FaSave style={{ marginRight: 8 }} /> Save (into ZIP)
                        </button>

                        <button
                            style={{ ...styles.primaryBtn, background: "#28a745", borderColor: "#23823a" }}
                            disabled={!activeTabObj}
                            onClick={() => activeIdx !== null && exportActiveTab(activeIdx)}
                        >
                            <FaDownload style={{ marginRight: 8 }} /> Export Tab
                        </button>
                    </div>

                    <div style={styles.previewBox}>
                        {activeTabObj ? (
                            <div
                                dangerouslySetInnerHTML={{ __html: activeTabObj.previewHtml }}
                                style={{ width: "100%" }}
                            />
                        ) : (
                            <div style={{ color: "#777" }}>No preview — select a tab</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
