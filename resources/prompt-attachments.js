(function () {
  const ATTACHMENT_LABEL = "粘贴的图像";
  const PREVIEW_OFFSET = 10;
  const MAX_IMAGE_BYTES = 32 * 1024 * 1024; // 32 MiB（官方单图上限）
  const MAX_IMAGE_SIDE = 1600; // 缩放最长边（官方会再缩到 ~800²，先缩省请求体）
  const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

  function createElement(tagName, className) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    return element;
  }

  function isImageFile(file) {
    return Boolean(file && typeof file.type === "string" && ALLOWED_MIME.has(file.type));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  }

  // 缩放图片（canvas）：最长边 > MAX_IMAGE_SIDE 时等比缩小，返回 JPEG data URL
  function resizeImageIfNeeded(dataUrl, mimeType) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = Math.max(img.width, img.height);
        if (maxSide <= MAX_IMAGE_SIDE) {
          resolve(dataUrl);
          return;
        }
        const scale = MAX_IMAGE_SIDE / maxSide;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // 缩放后统一输出 JPEG（GIF 动画缩放后只取首帧，可接受）
        try {
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function pickImageFileFromClipboard(event) {
    const items = Array.from(event.clipboardData?.items || []);
    for (const item of items) {
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile();
      if (isImageFile(file)) {
        return file;
      }
    }
    return null;
  }

  function createPromptAttachmentManager(options) {
    const promptInput = options?.promptInput;
    const inputWrap = options?.inputWrap;
    const toolsLine = options?.toolsLine;
    const onAttachmentChange = typeof options?.onAttachmentChange === "function"
      ? options.onAttachmentChange
      : function () {};

    if (!promptInput || !inputWrap || !toolsLine) {
      throw new Error("Prompt attachment manager requires promptInput, inputWrap, and toolsLine.");
    }

    let attachment = null;
    let previewPopup = null;
    let previewImage = null;

    function ensurePreviewPopup() {
      if (previewPopup) {
        return;
      }

      previewPopup = createElement("div", "chat-attached-context-preview");
      previewImage = createElement("img", "chat-attached-context-preview-image");
      previewImage.alt = ATTACHMENT_LABEL;
      previewPopup.appendChild(previewImage);
      document.body.appendChild(previewPopup);
    }

    function hidePreview() {
      if (!previewPopup) {
        return;
      }
      previewPopup.classList.remove("show");
    }

    function updatePreviewPosition(anchor) {
      if (!previewPopup || !anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const popupRect = previewPopup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = rect.left;
      let top = rect.top - popupRect.height - PREVIEW_OFFSET;

      if (left + popupRect.width > viewportWidth - 12) {
        left = viewportWidth - popupRect.width - 12;
      }
      if (left < 12) {
        left = 12;
      }
      if (top < 12) {
        top = rect.bottom + PREVIEW_OFFSET;
      }
      if (top + popupRect.height > viewportHeight - 12) {
        top = Math.max(12, viewportHeight - popupRect.height - 12);
      }

      previewPopup.style.left = left + "px";
      previewPopup.style.top = top + "px";
    }

    function showPreview(anchor) {
      if (!attachment) {
        return;
      }

      ensurePreviewPopup();
      previewImage.src = attachment.dataUrl;
      previewPopup.classList.add("show");
      updatePreviewPosition(anchor);
    }

    function emitChange() {
      onAttachmentChange({
        hasAttachments: Boolean(attachment),
        attachments: attachment ? [attachment] : []
      });
    }

    function clear() {
      attachment = null;
      toolsLine.innerHTML = "";
      toolsLine.classList.remove("has-attachment");
      hidePreview();
      emitChange();
    }

    function createAttachmentNode() {
      const wrapper = createElement(
        "div",
        "chat-attached-context-attachment chat-attached-context-image"
      );
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "button");
      wrapper.setAttribute("aria-label", ATTACHMENT_LABEL + " (删除)");
      wrapper.draggable = true;

      const removeButton = createElement("a", "monaco-button codicon codicon-close");
      removeButton.tabIndex = -1;
      removeButton.setAttribute("role", "button");
      removeButton.setAttribute("aria-label", "从上下文中移除");
      removeButton.href = "#";
      removeButton.textContent = "×";
      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clear();
      });

      // 直接显示大图缩略图（替代原小 pill + 文件名）
      const thumb = createElement("img", "chat-attached-context-thumb");
      thumb.src = attachment.dataUrl;
      thumb.alt = ATTACHMENT_LABEL;

      wrapper.appendChild(removeButton);
      wrapper.appendChild(thumb);

      const show = () => showPreview(wrapper);
      wrapper.addEventListener("mouseenter", show);
      wrapper.addEventListener("focus", show);
      wrapper.addEventListener("mouseleave", hidePreview);
      wrapper.addEventListener("blur", hidePreview);
      wrapper.addEventListener("dragstart", (event) => {
        event.preventDefault();
      });
      wrapper.addEventListener("keydown", (event) => {
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          clear();
        }
      });

      return wrapper;
    }

    function render() {
      toolsLine.innerHTML = "";
      toolsLine.classList.toggle("has-attachment", Boolean(attachment));
      if (!attachment) {
        hidePreview();
        return;
      }
      toolsLine.appendChild(createAttachmentNode());
    }

    function setAttachmentData(data) {
      if (!data?.dataUrl) {
        return false;
      }

      attachment = {
        name: data.name || ATTACHMENT_LABEL,
        mimeType: data.mimeType || "image/png",
        dataUrl: data.dataUrl,
        label: ATTACHMENT_LABEL
      };
      render();
      emitChange();
      return true;
    }

    async function setAttachmentFromFile(file) {
      if (!isImageFile(file)) {
        return false;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        console.error("Image too large (max 32 MiB).", file.size);
        return false;
      }

      const dataUrl = await readFileAsDataUrl(file);
      const mimeType = file.type || "image/png";
      const resized = await resizeImageIfNeeded(dataUrl, mimeType);
      return setAttachmentData({
        name: file.name || ATTACHMENT_LABEL,
        mimeType,
        dataUrl: resized,
        label: ATTACHMENT_LABEL
      });
    }

    async function handlePaste(event) {
      const file = pickImageFileFromClipboard(event);
      if (!file) {
        return;
      }

      event.preventDefault();
      try {
        await setAttachmentFromFile(file);
      } catch (error) {
        console.error("Failed to attach pasted image.", error);
      }
    }

    promptInput.addEventListener("paste", handlePaste);

    window.addEventListener("resize", () => {
      const attachmentNode = toolsLine.querySelector(".chat-attached-context-attachment");
      if (previewPopup?.classList.contains("show") && attachmentNode) {
        updatePreviewPosition(attachmentNode);
      }
    });

    window.addEventListener("scroll", () => {
      const attachmentNode = toolsLine.querySelector(".chat-attached-context-attachment");
      if (previewPopup?.classList.contains("show") && attachmentNode) {
        updatePreviewPosition(attachmentNode);
      }
    }, true);

    return {
      clear,
      hasAttachments() {
        return Boolean(attachment);
      },
      getImageUrls() {
        return attachment ? [attachment.dataUrl] : [];
      }
    };
  }

  window.createPromptAttachmentManager = createPromptAttachmentManager;
})();
