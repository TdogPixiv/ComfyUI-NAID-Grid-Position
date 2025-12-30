import { app } from "../../scripts/app.js";

app.registerExtension({
  name: "naid.grid.position",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "NAID Grid Position") return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;

    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, arguments);

      // Remove any legacy "random" widget/input from older python versions
      if (this.widgets) this.widgets = this.widgets.filter(w => w?.name !== "random");
      if (this.inputs && typeof this.removeInput === "function") {
        const idx = this.inputs.findIndex(i => i?.name === "random");
        if (idx !== -1) this.removeInput(idx);
      }

      const gridSize = 5;
      const cellSize = 28;
      const dpr = window.devicePixelRatio || 1;

      // UI container
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.padding = "8px";

      // Canvas
      const canvas = document.createElement("canvas");
      canvas.width = gridSize * cellSize * dpr;
      canvas.height = gridSize * cellSize * dpr;
      canvas.style.width = `${gridSize * cellSize}px`;
      canvas.style.height = `${gridSize * cellSize}px`;
      canvas.style.border = "1px solid #666";
      canvas.style.cursor = "pointer";
      container.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // stable DPR transform

      // Current grid cell (0..4)
      let gx = 2;
      let gy = 2;

      const label = document.createElement("div");
      label.style.cssText = "margin-top:6px; font-size:14px; font-weight:bold;";
      container.appendChild(label);

      function gridToValue(i) {
        // 0..4 -> 0.1,0.3,0.5,0.7,0.9
        return Number((i * 0.2 + 0.1).toFixed(2));
      }

      function valueToGrid(v) {
        const idx = Math.round((Number(v) - 0.1) / 0.2);
        return Math.min(4, Math.max(0, idx));
      }

      const redraw = () => {
        // clear in CSS pixel space (because ctx is DPR-transformed)
        ctx.clearRect(0, 0, gridSize * cellSize, gridSize * cellSize);

        for (let yy = 0; yy < gridSize; yy++) {
          for (let xx = 0; xx < gridSize; xx++) {
            ctx.strokeStyle = "#444";
            ctx.strokeRect(xx * cellSize, yy * cellSize, cellSize, cellSize);

            if (xx === gx && yy === gy) {
              ctx.fillStyle = "#ff6666";
              ctx.fillRect(xx * cellSize, yy * cellSize, cellSize, cellSize);
            }
          }
        }

        const letter = String.fromCharCode(65 + gx);
        const number = gy + 1;
        label.textContent = `${letter}${number}`;

        // force UI refresh in ComfyUI
        app?.graph?.setDirtyCanvas?.(true, true);
      };

      const setGrid = (xx, yy, pushToWidgets = true) => {
        gx = Math.min(4, Math.max(0, xx));
        gy = Math.min(4, Math.max(0, yy));

        if (pushToWidgets) {
          const xW = this.widgets?.find(w => w.name === "x");
          const yW = this.widgets?.find(w => w.name === "y");
          if (xW && yW) {
            xW.value = gridToValue(gx);
            yW.value = gridToValue(gy);

            // call onChange if present (some builds need this)
            xW.onChange?.(xW.value);
            yW.onChange?.(yW.value);
          }
        }

        redraw();
      };

      // Sync grid from sliders at creation + keep synced when user drags x/y
      const xW0 = this.widgets?.find(w => w.name === "x");
      const yW0 = this.widgets?.find(w => w.name === "y");
      if (xW0 && yW0) {
        gx = valueToGrid(xW0.value ?? 0.5);
        gy = valueToGrid(yW0.value ?? 0.5);

        const prevX = xW0.onChange;
        xW0.onChange = (v) => { prevX?.(v); gx = valueToGrid(v); redraw(); };

        const prevY = yW0.onChange;
        yW0.onChange = (v) => { prevY?.(v); gy = valueToGrid(v); redraw(); };
      }

      // Correct click mapping (no clunky DPR/zoom issues)
      canvas.addEventListener("pointerdown", (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;   // 0..1
        const py = (e.clientY - rect.top) / rect.height;   // 0..1
        const xx = Math.floor(px * gridSize);
        const yy = Math.floor(py * gridSize);
        setGrid(xx, yy, true);
      });

      // Bottom "Random" checkbox (DOM only)
      const randomDiv = document.createElement("div");
      randomDiv.style.display = "flex";
      randomDiv.style.alignItems = "center";
      randomDiv.style.marginTop = "8px";

      const randomText = document.createElement("span");
      randomText.textContent = "Random";
      randomText.style.marginRight = "8px";

      const randomCheckbox = document.createElement("input");
      randomCheckbox.type = "checkbox";
      randomCheckbox.checked = false;

      randomDiv.appendChild(randomText);
      randomDiv.appendChild(randomCheckbox);
      container.appendChild(randomDiv);

      this.naidRandomEnabled = false;
      this.naidRandomize = () => {
        const rx = Math.floor(Math.random() * 5);
        const ry = Math.floor(Math.random() * 5);
        setGrid(rx, ry, true); // updates x/y + grid + label
      };

      randomCheckbox.onchange = () => {
        this.naidRandomEnabled = randomCheckbox.checked;
        if (this.naidRandomEnabled) this.naidRandomize(); // preview once
      };

      this.addDOMWidget("grid_ui", "custom", container);

      // initial draw
      redraw();
    };

    // Most compatible: randomize when prompt is built (not queuePrompt)
    if (!app.__naidGridRandomPatched) {
      app.__naidGridRandomPatched = true;

      const originalGraphToPrompt = app.graphToPrompt.bind(app);

      app.graphToPrompt = async function (...args) {
        try {
          const nodes = app.graph?._nodes || [];
          for (const n of nodes) {
            if (typeof n?.naidRandomize === "function" && n.naidRandomEnabled) {
              n.naidRandomize();
            }
          }
        } catch (err) {
          console.warn("[naid.grid.position] randomize before prompt failed:", err);
        }
        return originalGraphToPrompt(...args);
      };
    }
  }
});
