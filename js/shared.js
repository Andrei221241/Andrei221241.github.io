(() => {
    "use strict";

    const onReady = (fn) => {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fn, { once: true });
        } else {
            fn();
        }
    };

    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    const parseNum = (v, fallback) => {
        const n = Number.parseFloat(v);
        return Number.isFinite(n) ? n : fallback;
    };

    const parseCSV = (v) =>
        String(v || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

    const parseCSVNums = (v) =>
        parseCSV(v)
            .map((x) => Number.parseFloat(x))
            .filter((n) => Number.isFinite(n));

    function initYear() {
        const yearEl = qs("#year");
        if (!yearEl) return;
        yearEl.textContent = String(new Date().getFullYear());
    }

    function initMenu() {
        const menuToggle = document.querySelector(".menu-toggle, [data-menu-toggle]");
        if (!menuToggle) return;

        // Prefer aria-controls to find the menu (works across pages)
        const targetId = menuToggle.getAttribute("aria-controls");
        const navMenu =
            (targetId && document.getElementById(targetId)) ||
            document.querySelector(".nav-menu, [data-nav-menu]");

        if (!navMenu) return;

        const mq = window.matchMedia("(max-width: 768px)");

        function setOpen(open) {
            navMenu.classList.toggle("active", open);
            menuToggle.setAttribute("aria-expanded", String(open));

            // Make it work even if CSS is wrong:
            if (open) navMenu.removeAttribute("hidden");
            else navMenu.setAttribute("hidden", "");
        }

        // Ensure correct initial state on mobile
        if (mq.matches && !navMenu.classList.contains("active")) {
            navMenu.setAttribute("hidden", "");
            menuToggle.setAttribute("aria-expanded", "false");
        } else if (!mq.matches) {
            navMenu.removeAttribute("hidden"); // desktop should show normally
        }

        menuToggle.addEventListener("click", () => {
            const isOpen = !navMenu.hasAttribute("hidden");
            setOpen(!isOpen);
        });

        document.addEventListener("click", (e) => {
            if (!mq.matches) return;
            if (navMenu.hasAttribute("hidden")) return;
            if (navMenu.contains(e.target) || menuToggle.contains(e.target)) return;
            setOpen(false);
        });

        window.addEventListener("resize", () => {
            if (!mq.matches) {
                // desktop: keep visible
                navMenu.removeAttribute("hidden");
                navMenu.classList.remove("active");
                menuToggle.setAttribute("aria-expanded", "false");
            } else {
                // mobile: close by default
                setOpen(false);
            }
        });

        navMenu.addEventListener("click", (e) => {
            if (mq.matches && e.target.closest("a")) setOpen(false);
        });
    }


    function initImageModal() {
        const modal = qs("#imgModal");
        const modalImg = qs("#modalImg");
        const modalCaption = qs("#modalCaption");
        const closeBtn = modal ? qs(".modal-close", modal) : null;

        if (!modal || !modalImg || !modalCaption || !closeBtn) return;

        const figures = () => qsa("figure.gallery-item, .gallery-item");

        function getFullSrc(fig) {
            const img = qs("img", fig);
            return (
                fig.getAttribute("data-full") ||
                fig.dataset.full ||
                (img ? img.src : "")
            );
        }

        function getCaptionHTML(fig) {
            const c1 = qs(".fig-caption", fig);
            const c2 = qs("figcaption", fig);
            return (c1 && c1.innerHTML) || (c2 && c2.innerHTML) || "";
        }

        function openModal(fig) {
            const img = qs("img", fig);
            modalImg.src = getFullSrc(fig);
            modalImg.alt = (img && img.alt) ? img.alt : "";
            modalCaption.innerHTML = getCaptionHTML(fig);

            modal.setAttribute("data-open", "true");
            modal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
            closeBtn.focus();
        }

        function closeModal() {
            modal.setAttribute("data-open", "false");
            modal.setAttribute("aria-hidden", "true");
            modalImg.src = "";
            modalCaption.innerHTML = "";
            document.body.style.overflow = "";
        }

        figures().forEach((fig) => {
            fig.addEventListener("click", () => openModal(fig));
            fig.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openModal(fig);
                }
            });
        });

        closeBtn.addEventListener("click", closeModal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.getAttribute("data-open") === "true") {
                closeModal();
            }
        });
    }

    function initCharts() {
        if (!window.Plotly || typeof window.Plotly.newPlot !== "function") return;

        const perfEl = qs("#perfBarChart");
        if (perfEl) {

            const cpuPct = parseNum(perfEl.dataset.cpu, 100);
            const diskMBps = parseNum(perfEl.dataset.disk, 248);
            const netGbps = parseNum(perfEl.dataset.net, 3.05);

            const diskScale = parseNum(perfEl.dataset.diskScale, 500);
            const netScale = parseNum(perfEl.dataset.netScale, 10);

            const labels = ["CPU", "Disk (write)", "Network"];
            const scaled = [
                (cpuPct / 100) * 100,
                (diskMBps / diskScale) * 100,
                (netGbps / netScale) * 100,
            ];

            const textLabels = [`${cpuPct}%`, `${diskMBps} MB/s`, `${netGbps} Gbit/s`];

            Plotly.newPlot(
                "perfBarChart",
                [
                    {
                        type: "bar",
                        x: labels,
                        y: scaled,
                        text: textLabels,
                        textposition: "auto",
                        hovertemplate:
                            "<b>%{x}</b><br>Measured: %{text}<br>Scaled: %{y:.1f}%<extra></extra>",
                    },
                ],
                {
                    title: "Performance summary (CPU, Disk, Network)",
                    yaxis: { title: "Scaled score (%)", range: [0, 110] },
                    annotations: [
                        {
                            xref: "paper",
                            yref: "paper",
                            x: 0,
                            y: -0.25,
                            showarrow: false,
                            text:
                                `Scaling used: CPU out of 100%, Disk out of ${diskScale} MB/s, ` +
                                `Network out of ${netScale} Gbit/s (visual comparison).`,
                        },
                    ],
                    margin: { t: 50, r: 20, b: 80, l: 60 },
                },
                { responsive: true }
            );
        }

        const cpuEl = qs("#cpuChart");
        if (cpuEl) {

            const stages = parseCSV(cpuEl.dataset.stages).length
                ? parseCSV(cpuEl.dataset.stages)
                : ["Baseline", "iperf3 run", "Post-load"];

            const usage = parseCSVNums(cpuEl.dataset.usage).length
                ? parseCSVNums(cpuEl.dataset.usage)
                : [3, 18, 5];

            Plotly.newPlot(
                "cpuChart",
                [
                    {
                        x: stages,
                        y: usage,
                        type: "scatter",
                        mode: "lines+markers",
                        name: "CPU utilisation",
                    },
                ],
                {
                    title: "CPU utilisation across baseline, load and post-load periods",
                    xaxis: { title: "Test phase" },
                    yaxis: { title: "CPU utilisation (%)", rangemode: "tozero" },
                    margin: { t: 40, r: 20, b: 40, l: 50 },
                },
                { responsive: true }
            );
        }


        const netEl = qs("#netChart");
        if (netEl) {

            const runs = parseCSV(netEl.dataset.runs).length
                ? parseCSV(netEl.dataset.runs)
                : ["iperf3 run 1", "iperf3 run 2"];

            const throughput = parseCSVNums(netEl.dataset.throughput).length
                ? parseCSVNums(netEl.dataset.throughput)
                : [2.9, 3.0];

            const retrans = parseCSVNums(netEl.dataset.retrans).length
                ? parseCSVNums(netEl.dataset.retrans)
                : [8200, 10500];

            Plotly.newPlot(
                "netChart",
                [
                    {
                        x: runs,
                        y: throughput,
                        type: "bar",
                        name: "Throughput (Gbit/s)",
                        yaxis: "y1",
                    },
                    {
                        x: runs,
                        y: retrans,
                        type: "scatter",
                        mode: "lines+markers",
                        name: "Retransmissions",
                        yaxis: "y2",
                    },
                ],
                {
                    title: "Network throughput and retransmissions (iperf3)",
                    xaxis: { title: "Test run" },
                    yaxis: { title: "Throughput (Gbit/s)", rangemode: "tozero" },
                    yaxis2: {
                        title: "Retransmissions",
                        overlaying: "y",
                        side: "right",
                        rangemode: "tozero",
                    },
                    legend: { orientation: "h" },
                    margin: { t: 40, r: 60, b: 40, l: 50 },
                },
                { responsive: true }
            );
        }
    }

    onReady(() => {
        initYear();
        initMenu();
        initImageModal();
        initCharts();
    });
})();