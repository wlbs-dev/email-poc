import React, { useState, useRef } from "react";
import JSZip from "jszip";

export default function ZipHtmlEditor() {
    const [zip, setZip] = useState(null);
    const [htmlFiles, setHtmlFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);

    const [textNodes, setTextNodes] = useState([]);
    const [previewHtml, setPreviewHtml] = useState("");

    const rawHtmlRef = useRef("");
    const domRef = useRef(null);
    const imageMap = useRef({});

    // ------------------ 1. Upload ZIP ------------------
    const handleUpload = async (e) => {
        const file = e.target.files[0];
        const jszip = await JSZip.loadAsync(file);
        setZip(jszip);

        const htmlList = [];
        const imgMap = {};
        const imagePromises = [];

        jszip.forEach((path, file) => {
            if (path.endsWith(".html")) {
                htmlList.push(path);
            }

            if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(path)) {
                imagePromises.push(
                    file.async("blob").then((blob) => {
                        imgMap[path] = URL.createObjectURL(blob);
                    })
                );
            }
        });

        await Promise.all(imagePromises);

        imageMap.current = imgMap;
        setHtmlFiles(htmlList);
    };

    // ------------------ 2. Load HTML & Extract Text + Fix Images ------------------
    const loadHtml = async (fileName) => {
        const file = zip.file(fileName);
        const html = await file.async("text");

        rawHtmlRef.current = html;
        setSelectedFile(fileName);

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        domRef.current = doc;

        const htmlDir = fileName.split("/").slice(0, -1).join("/");

        // Fix image preview
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
                img.src = imageMap.current[normalized]; // blob for preview only
            }
        });

        // Extract text nodes
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

        setTextNodes(extracted);
        setPreviewHtml(doc.body.innerHTML);
    };

    // ------------------ 3. Handle Text Change ------------------
    const updateText = (id, value) => {
        const updated = textNodes.map((t) =>
            t.id === id ? { ...t, updated: value } : t
        );
        setTextNodes(updated);

        updated.forEach((item) => {
            item.nodeRef.textContent = item.updated;
        });

        setPreviewHtml(domRef.current.body.innerHTML);
    };

    // ------------------ 4. Save Only Text (Restore Image Paths) ------------------
    const saveToZip = () => {
        textNodes.forEach((t) => {
            t.nodeRef.textContent = t.updated;
        });

        // restore original image src
        domRef.current.querySelectorAll("img").forEach((img) => {
            if (img.dataset.originalSrc) {
                img.src = img.dataset.originalSrc;
            }
        });

        const finalHtml = domRef.current.documentElement.outerHTML;
        zip.file(selectedFile, finalHtml);

        alert("Saved inside ZIP (not downloaded yet)");
    };

    // ------------------ 5. Download ZIP ------------------
    const downloadZip = async () => {
        saveToZip();
        const blob = await zip.generateAsync({ type: "blob" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "updated.zip";
        a.click();
    };

    return (
        <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
            {/* Sidebar */}
            <div
                style={{
                    width: "300px",
                    borderRight: "1px solid #ddd",
                    padding: 20,
                    background: "#f4f4f4",
                    overflowY: "auto",
                }}
            >
                <h2>ZIP HTML Editor</h2>

                <input type="file" accept=".zip" onChange={handleUpload} />

                <h3 style={{ marginTop: 20 }}>HTML Files</h3>
                <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                    {htmlFiles.map((f) => (
                        <li
                            key={f}
                            onClick={() => loadHtml(f)}
                            style={{
                                padding: "8px",
                                cursor: "pointer",
                                background: selectedFile === f ? "#dce7ff" : "",
                                borderRadius: 4,
                            }}
                        >
                            {f}
                        </li>
                    ))}
                </ul>

                {selectedFile && (
                    <>
                        <button
                            style={{ marginTop: 20, padding: "10px 15px" }}
                            onClick={saveToZip}
                        >
                            Save Changes
                        </button>

                        <button
                            style={{
                                marginTop: 10,
                                padding: "10px 15px",
                                background: "#0a66c2",
                                color: "#fff",
                                border: "none",
                            }}
                            onClick={downloadZip}
                        >
                            Download ZIP
                        </button>
                    </>
                )}
            </div>

            {/* Text Editing Panel */}
            <div
                style={{
                    width: "400px",
                    borderRight: "1px solid #ddd",
                    padding: 20,
                    overflowY: "auto",
                }}
            >
                <h3>Editable Text Content</h3>

                {textNodes.map((item) => (
                    <div key={item.id} style={{ marginBottom: 15 }}>
                        <label style={{ fontSize: 14, fontWeight: "bold" }}>
                            Original:
                        </label>
                        <div style={{ fontSize: 13, color: "#444", marginBottom: 5 }}>
                            {item.original}
                        </div>

                        <input
                            type="text"
                            value={item.updated}
                            onChange={(e) => updateText(item.id, e.target.value)}
                            style={{
                                width: "100%",
                                padding: 8,
                                border: "1px solid #ccc",
                                borderRadius: 4,
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Live Preview */}
            <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
                <h3>Live Preview</h3>

                <div
                    style={{
                        padding: 20,
                        background: "white",
                        border: "1px solid #ccc",
                        minHeight: "90vh",
                        borderRadius: 8,
                    }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
            </div>
        </div>
    );
}
