/* =========================================================
   KUMBH SEVA — CITIZEN PROBLEM REPORTING (report.js)
   All logic for /report is isolated here. Nothing here touches
   main.js or any other page.
   ========================================================= */

(function () {
  "use strict";

  /* -----------------------------------------------------------
     CONFIG
     ----------------------------------------------------------- */

  const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const DESCRIPTION_MAX_LENGTH = 500;

  const CATEGORY_CONFIG = {
    dustbin: {
      icon: "🚮",
      title: "Garbage Bin",
      desc: "Report a problem with this garbage bin",
      options: ["Overflowing", "Damaged", "Missing", "Bad smell", "Garbage scattered around", "Other"]
    },
    tap: {
      icon: "🚰",
      title: "Water Tap",
      desc: "Report a problem with this water tap",
      options: ["No water", "Water leakage", "Damaged tap", "Dirty water", "Low water flow", "Other"]
    },
    toilet: {
      icon: "🚻",
      title: "Toilet",
      desc: "Report a problem with this toilet",
      options: ["Unclean toilet", "Water unavailable", "Damaged toilet", "Bad smell", "Overflowing", "Other"]
    },
    drinking_water: {
      icon: "💧",
      title: "Drinking Water",
      desc: "Report a problem with this drinking water facility",
      options: ["No water", "Dirty water", "Leakage", "Damaged facility", "Low water supply", "Other"]
    },
    other: {
      icon: "➕",
      title: "Other Problem",
      desc: "Tell us about the problem you'd like to report.",
      options: null // free-text description instead of a fixed list
    }
  };

  // Mock QR lookup table. Swap this + the scan handler for a real QR library later.
  const MOCK_ASSET_DIRECTORY = {
    "PEN-GB-01": { area: "Panchavati", name: "Garbage Bin #01" },
    "PEN-TP-01": { area: "Panchavati", name: "Water Tap #01" },
    "PEN-TO-03": { area: "Panchavati", name: "Toilet Block #03" },
    "PEN-DW-02": { area: "Panchavati", name: "Drinking Water Point #02" }
  };

  /* -----------------------------------------------------------
     STATE
     ----------------------------------------------------------- */

  const state = {
    problemType: "other",
    problemSubtype: "",
    photoFile: null,
    photoValid: false,
    assetId: "",
    assetArea: "",
    assetName: "",
    latitude: null,
    longitude: null,
    locationLabel: "",
    submitting: false
  };

  /* -----------------------------------------------------------
     DOM SHORTCUTS
     ----------------------------------------------------------- */

  const $ = (id) => document.getElementById(id);

  const el = {
    categoryIcon: $("categoryIcon"),
    categoryTitle: $("categoryTitle"),
    categoryDesc: $("categoryDesc"),

    photoDropzone: $("photoDropzone"),
    reportPhoto: $("reportPhoto"),
    dropzoneContent: $("dropzoneContent"),
    photoPreviewCard: $("photoPreviewCard"),
    photoPreviewImg: $("photoPreviewImg"),
    photoFileName: $("photoFileName"),
    photoFileSize: $("photoFileSize"),
    replacePhotoBtn: $("replacePhotoBtn"),
    removePhotoBtn: $("removePhotoBtn"),
    photoErrorAlert: $("photoErrorAlert"),
    photoErrorText: $("photoErrorText"),

    problemTypeSection: $("problemTypeSection"),
    problemOptionsGrid: $("problemOptionsGrid"),
    otherProblemWrap: $("otherProblemWrap"),
    otherProblemText: $("otherProblemText"),
    problemTypeErrorAlert: $("problemTypeErrorAlert"),

    detailsSection: $("detailsSection"),
    additionalDetails: $("additionalDetails"),
    charCount: $("charCount"),

    qrSection: $("qrSection"),
    scanQrBtn: $("scanQrBtn"),
    manualAssetId: $("manualAssetId"),
    confirmManualAssetBtn: $("confirmManualAssetBtn"),
    qrScannerModal: $("qrScannerModal"),
    cancelQrScanBtn: $("cancelQrScanBtn"),
    qrPanelIdle: $("qrPanelIdle"),
    assetResultCard: $("assetResultCard"),
    assetResultId: $("assetResultId"),
    assetResultArea: $("assetResultArea"),
    assetResultName: $("assetResultName"),
    clearAssetBtn: $("clearAssetBtn"),
    qrErrorAlert: $("qrErrorAlert"),
    qrErrorText: $("qrErrorText"),

    locationSection: $("locationSection"),
    locationIdle: $("locationIdle"),
    detectLocationBtn: $("detectLocationBtn"),
    locationResultCard: $("locationResultCard"),
    locationAreaName: $("locationAreaName"),
    locationLat: $("locationLat"),
    locationLng: $("locationLng"),
    retryLocationBtn: $("retryLocationBtn"),
    locationErrorAlert: $("locationErrorAlert"),
    locationErrorText: $("locationErrorText"),
    mapPreview: $("mapPreview"),

    reviewSection: $("reviewSection"),
    reviewCategory: $("reviewCategory"),
    reviewProblemType: $("reviewProblemType"),
    reviewPhoto: $("reviewPhoto"),
    reviewAssetId: $("reviewAssetId"),
    reviewLocation: $("reviewLocation"),
    reviewDetails: $("reviewDetails"),

    submitSection: $("submitSection"),
    submitReportBtn: $("submitReportBtn"),
    submitErrorAlert: $("submitErrorAlert"),
    submitErrorText: $("submitErrorText"),
    submitHint: $("submitHint"),

    reportForm: $("reportForm"),
    successScreen: $("successScreen"),
    complaintIdText: $("complaintIdText"),
    trackReportBtn: $("trackReportBtn"),
    reportAnotherBtn: $("reportAnotherBtn"),

    problemTypeField: $("problemTypeField"),
    problemSubtypeField: $("problemSubtypeField"),
    assetIdField: $("assetIdField"),
    latitudeField: $("latitudeField"),
    longitudeField: $("longitudeField"),
    timestampField: $("timestampField"),

    toastHost: $("toastHost"),
    reportProgress: $("reportProgress")
  };

  /* -----------------------------------------------------------
     INIT
     ----------------------------------------------------------- */

  function initializeReportPage() {
    state.problemType = getProblemCategory();
    renderCategoryBanner(state.problemType);

    setupPhotoUpload();
    setupProblemOptions(state.problemType);
    setupCharCounter();
    setupQRScanner();
    setupLocation();
    setupReviewEditLinks();
    setupFormSubmit();
    setupSuccessActions();

    updateReview();
    validateReport();
  }

  /* -----------------------------------------------------------
     1. CATEGORY
     ----------------------------------------------------------- */

  function getProblemCategory() {
    const fromServer = (window.KUMBH_SEVA_PROBLEM_TYPE || "").trim();
    if (fromServer && CATEGORY_CONFIG[fromServer]) return fromServer;

    // Fallback: parse from the URL directly, in case the template didn't inject it.
    const params = new URLSearchParams(window.location.search);
    const type = (params.get("type") || "other").trim();
    return CATEGORY_CONFIG[type] ? type : "other";
  }

  function renderCategoryBanner(type) {
    const cfg = CATEGORY_CONFIG[type];
    el.categoryIcon.textContent = cfg.icon;
    el.categoryTitle.textContent = cfg.title;
    el.categoryDesc.textContent = cfg.desc;
    el.problemTypeField.value = type;
  }

  /* -----------------------------------------------------------
     PHOTO UPLOAD (2–9 combined: select, drag/drop, validate, preview, replace, remove)
     ----------------------------------------------------------- */

  function setupPhotoUpload() {
    el.photoDropzone.addEventListener("click", (e) => {
      // Avoid double-opening if the click landed on the preview action buttons.
      if (e.target.closest(".gt-file-actions")) return;
      el.reportPhoto.click();
    });

    el.photoDropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.reportPhoto.click();
      }
    });

    el.reportPhoto.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleSelectedPhoto(file);
    });

    ["dragover", "dragenter"].forEach((evt) => {
      el.photoDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        el.photoDropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "dragend"].forEach((evt) => {
      el.photoDropzone.addEventListener(evt, () => {
        el.photoDropzone.classList.remove("is-dragover");
      });
    });

    el.photoDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      el.photoDropzone.classList.remove("is-dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleSelectedPhoto(file);
    });

    el.replacePhotoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      el.reportPhoto.value = "";
      el.reportPhoto.click();
    });

    el.removePhotoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removePhoto();
    });
  }

  function handleSelectedPhoto(file) {
    hidePhotoError();
    const validation = validateImage(file);

    if (!validation.valid) {
      state.photoFile = null;
      state.photoValid = false;
      showPhotoError(validation.message);
      resetDropzoneToEmpty();
      validateReport();
      updateReview();
      return;
    }

    state.photoFile = file;
    state.photoValid = true;
    showPhotoPreview(file);
    validateReport();
    updateReview();
  }

  function validateImage(file) {
    if (!file) {
      return { valid: false, message: "Please select a photo to continue." };
    }
    const typeOk = ALLOWED_PHOTO_TYPES.includes(file.type.toLowerCase());
    const sizeOk = file.size <= MAX_PHOTO_BYTES;

    if (!typeOk || !sizeOk) {
      return {
        valid: false,
        message: "Please upload a valid JPG, PNG or WEBP image under 10 MB."
      };
    }
    return { valid: true, message: "" };
  }

  function showPhotoPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      el.photoPreviewImg.src = e.target.result;
      el.photoFileName.textContent = file.name;
      el.photoFileSize.textContent = formatFileSize(file.size);
      el.dropzoneContent.classList.add("d-none");
      el.photoPreviewCard.classList.remove("d-none");
      el.photoDropzone.classList.add("has-preview");
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    state.photoFile = null;
    state.photoValid = false;
    el.reportPhoto.value = "";
    resetDropzoneToEmpty();
    validateReport();
    updateReview();
  }

  function resetDropzoneToEmpty() {
    el.photoPreviewImg.src = "";
    el.photoPreviewCard.classList.add("d-none");
    el.dropzoneContent.classList.remove("d-none");
    el.photoDropzone.classList.remove("has-preview");
  }

  function showPhotoError(message) {
    el.photoErrorText.textContent = message;
    el.photoErrorAlert.classList.remove("d-none");
    showToast(message, "error");
  }

  function hidePhotoError() {
    el.photoErrorAlert.classList.add("d-none");
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  /* -----------------------------------------------------------
     10. PROBLEM TYPE SELECTION
     ----------------------------------------------------------- */

  function setupProblemOptions(type) {
    el.problemTypeSection.classList.remove("d-none");
    const cfg = CATEGORY_CONFIG[type];

    if (!cfg.options) {
      // "Other" category: free-text description instead of chips.
      el.problemOptionsGrid.classList.add("d-none");
      el.otherProblemWrap.classList.remove("d-none");
      el.otherProblemText.addEventListener("input", () => {
        state.problemSubtype = el.otherProblemText.value.trim();
        el.problemSubtypeField.value = state.problemSubtype;
        hideProblemTypeError();
        validateReport();
        updateReview();
      });
      return;
    }

    el.problemOptionsGrid.classList.remove("d-none");
    el.otherProblemWrap.classList.add("d-none");
    el.problemOptionsGrid.innerHTML = "";

    cfg.options.forEach((label, index) => {
      const id = `problemOption_${index}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gt-option-chip";
      btn.id = id;
      btn.textContent = label;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");

      btn.addEventListener("click", () => selectProblemOption(label, btn));
      el.problemOptionsGrid.appendChild(btn);
    });
  }

  function selectProblemOption(label, buttonEl) {
    // Clear previous selection
    Array.from(el.problemOptionsGrid.children).forEach((chip) => {
      chip.classList.remove("is-selected");
      chip.setAttribute("aria-checked", "false");
    });

    buttonEl.classList.add("is-selected");
    buttonEl.setAttribute("aria-checked", "true");

    state.problemSubtype = label;
    el.problemSubtypeField.value = label;

    hideProblemTypeError();
    validateReport();
    updateReview();
  }

  function hideProblemTypeError() {
    el.problemTypeErrorAlert.classList.add("d-none");
  }

  function showProblemTypeError() {
    el.problemTypeErrorAlert.classList.remove("d-none");
  }

  /* -----------------------------------------------------------
     11. CHARACTER COUNTER (additional details)
     ----------------------------------------------------------- */

  function setupCharCounter() {
    el.detailsSection.classList.remove("d-none");
    el.additionalDetails.addEventListener("input", () => {
      const length = el.additionalDetails.value.length;
      el.charCount.textContent = Math.min(length, DESCRIPTION_MAX_LENGTH);
      updateReview();
    });
  }

  /* -----------------------------------------------------------
     12–13. GPS DETECTION & LAT/LNG STORAGE
     ----------------------------------------------------------- */

  function setupLocation() {
    el.locationSection.classList.remove("d-none");
    el.detectLocationBtn.addEventListener("click", detectLocation);
    el.retryLocationBtn.addEventListener("click", detectLocation);
  }

  function detectLocation() {
    hideLocationError();

    if (!("geolocation" in navigator)) {
      showLocationError("Location services are not available on this device. Please select your location manually.");
      return;
    }

    el.detectLocationBtn.disabled = true;
    el.detectLocationBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Detecting...';

    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      onLocationError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function onLocationSuccess(position) {
    resetDetectButton();

    state.latitude = position.coords.latitude;
    state.longitude = position.coords.longitude;
    // Placeholder label — swap for a reverse-geocoding call when the backend is wired up.
    state.locationLabel = "Panchavati, Nashik";

    el.latitudeField.value = state.latitude;
    el.longitudeField.value = state.longitude;

    el.locationAreaName.textContent = state.locationLabel;
    el.locationLat.textContent = state.latitude.toFixed(6);
    el.locationLng.textContent = state.longitude.toFixed(6);

    el.locationIdle.classList.add("d-none");
    el.locationResultCard.classList.remove("d-none");

    validateReport();
    updateReview();
  }

  function onLocationError(error) {
    resetDetectButton();

    if (error.code === error.PERMISSION_DENIED) {
      showLocationError("Location permission was denied. Please enable location access or select your location manually.");
    } else {
      showLocationError("We couldn't detect your location. Please check your GPS/network and try again.");
    }
    validateReport();
  }

  function resetDetectButton() {
    el.detectLocationBtn.disabled = false;
    el.detectLocationBtn.innerHTML = '<i class="bi bi-crosshair"></i> Detect My Location';
  }

  function showLocationError(message) {
    el.locationErrorText.textContent = message;
    el.locationErrorAlert.classList.remove("d-none");
    showToast(message, "error");
  }

  function hideLocationError() {
    el.locationErrorAlert.classList.add("d-none");
  }

  /* -----------------------------------------------------------
     14–15. QR SCANNER UI + MANUAL ASSET ID
     ----------------------------------------------------------- */

  function setupQRScanner() {
    el.qrSection.classList.remove("d-none");

    el.scanQrBtn.addEventListener("click", openQrScanner);
    el.cancelQrScanBtn.addEventListener("click", closeQrScanner);
    el.confirmManualAssetBtn.addEventListener("click", () => {
      const value = el.manualAssetId.value.trim().toUpperCase();
      if (!value) {
        showQrError("Please enter an Asset ID.");
        return;
      }
      resolveAssetId(value);
    });
    el.clearAssetBtn.addEventListener("click", clearAssetSelection);
  }

  /**
   * Opens the QR scanner UI. This is intentionally a thin, swappable shell:
   * plug a real scanning library (e.g. html5-qrcode, jsQR + getUserMedia) in here.
   * On a successful scan, call resolveAssetId(decodedText) and then closeQrScanner().
   */
  function openQrScanner() {
    hideQrError();
    el.qrScannerModal.classList.remove("d-none");
    document.body.style.overflow = "hidden";

    // --- Integration point for a real QR library goes here. ---
    // Example once a library is added:
    //   startQrStream(el.qrScannerViewport, (decodedText) => {
    //     resolveAssetId(decodedText);
    //     closeQrScanner();
    //   });
  }

  function closeQrScanner() {
    el.qrScannerModal.classList.add("d-none");
    document.body.style.overflow = "";
    // --- If a real scanner stream was started, stop it here. ---
    //   stopQrStream();
  }

  function resolveAssetId(assetId) {
    const match = MOCK_ASSET_DIRECTORY[assetId];

    if (!match) {
      showQrError("We couldn't identify that asset. Try scanning again or check the ID.");
      return;
    }

    state.assetId = assetId;
    state.assetArea = match.area;
    state.assetName = match.name;
    el.assetIdField.value = assetId;

    el.assetResultId.textContent = assetId;
    el.assetResultArea.textContent = match.area;
    el.assetResultName.textContent = match.name;

    el.qrPanelIdle.classList.add("d-none");
    el.assetResultCard.classList.remove("d-none");
    hideQrError();
    closeQrScanner();

    validateReport();
    updateReview();
  }

  function clearAssetSelection() {
    state.assetId = "";
    state.assetArea = "";
    state.assetName = "";
    el.assetIdField.value = "";
    el.manualAssetId.value = "";

    el.assetResultCard.classList.add("d-none");
    el.qrPanelIdle.classList.remove("d-none");

    validateReport();
    updateReview();
  }

  function showQrError(message) {
    el.qrErrorText.textContent = message;
    el.qrErrorAlert.classList.remove("d-none");
  }

  function hideQrError() {
    el.qrErrorAlert.classList.add("d-none");
  }

  /* -----------------------------------------------------------
     REVIEW EDIT LINKS
     ----------------------------------------------------------- */

  function setupReviewEditLinks() {
    el.reviewSection.classList.remove("d-none");
    document.querySelectorAll(".gt-review-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-edit-target");
        const target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* -----------------------------------------------------------
     16–17. VALIDATION + REVIEW SYNC
     ----------------------------------------------------------- */

  function isProblemTypeComplete() {
    const cfg = CATEGORY_CONFIG[state.problemType];
    if (!cfg.options) {
      return el.otherProblemText.value.trim().length > 0;
    }
    return Boolean(state.problemSubtype);
  }

  function validateReport() {
    const hasPhoto = state.photoValid && !!state.photoFile;
    const hasProblemType = isProblemTypeComplete();
    const hasLocation = state.latitude !== null && state.longitude !== null;

    const isComplete = hasPhoto && hasProblemType && hasLocation;

    el.submitReportBtn.disabled = state.submitting || !isComplete;

    if (isComplete) {
      el.submitHint.textContent = "You're all set — review your report below and submit.";
    } else {
      const missing = [];
      if (!hasPhoto) missing.push("a photo");
      if (!hasProblemType) missing.push("a problem type");
      if (!hasLocation) missing.push("your location");
      el.submitHint.textContent = `Add ${missing.join(", ")} to continue.`;
    }

    return isComplete;
  }

  function updateReview() {
    const cfg = CATEGORY_CONFIG[state.problemType];
    el.reviewCategory.textContent = `${cfg.icon} ${cfg.title}`;

    if (!cfg.options) {
      el.reviewProblemType.textContent = el.otherProblemText.value.trim() || "—";
    } else {
      el.reviewProblemType.textContent = state.problemSubtype || "—";
    }

    el.reviewPhoto.innerHTML = state.photoValid
      ? '<i class="bi bi-check-circle-fill text-success"></i> Photo attached'
      : "Not added";

    el.reviewAssetId.textContent = state.assetId
      ? `state.assetId({state.assetName})`
      : "Not identified";

    el.reviewLocation.textContent = (state.latitude !== null)
      ? `state.locationLabel({state.latitude.toFixed(5)}, ${state.longitude.toFixed(5)})`
      : "Not detected";

    const details = el.additionalDetails.value.trim();
    el.reviewDetails.textContent = details || "None provided";
  }

  /* -----------------------------------------------------------
     18–20. SUBMIT / LOADING / MOCK SUBMISSION
     ----------------------------------------------------------- */

  function setupFormSubmit() {
    el.reportForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitReport();
    });
  }

  function submitReport() {
    hideSubmitError();

    if (!isProblemTypeComplete()) {
      showProblemTypeError();
      showToast("Please select a problem type before continuing.", "error");
      document.getElementById("problemTypeSection").scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!validateReport()) {
      showToast("Please complete all required fields before submitting.", "error");
      return;
    }

    state.submitting = true;
    setSubmitLoading(true);

    el.timestampField.value = new Date().toISOString();

    // Build the FormData payload exactly as the backend contract expects.
    const formData = new FormData();
    formData.append("problem_type", state.problemType);
    formData.append("problem_subtype", isFreeTextCategory()
      ? el.otherProblemText.value.trim()
      : state.problemSubtype);
    formData.append("photo", state.photoFile);
    formData.append("description", el.additionalDetails.value.trim());
    formData.append("asset_id", state.assetId || "");
    formData.append("latitude", state.latitude);
    formData.append("longitude", state.longitude);
    formData.append("timestamp", el.timestampField.value);

    // --- Backend integration point ---
    // Once the API exists, replace mockSubmit() with:
    //
    // fetch("/api/reports", { method: "POST", body: formData })
    //   .then((res) => {
    //     if (!res.ok) throw new Error("Submission failed");
    //     return res.json();
    //   })
    //   .then((data) => {
    //     setSubmitLoading(false);
    //     state.submitting = false;
    //     showSuccess(data.complaint_id);
    //   })
    //   .catch((err) => {
    //     setSubmitLoading(false);
    //     state.submitting = false;
    //     showSubmitError("We couldn't submit your report. Please check your connection and try again.");
    //   });

    mockSubmit()
      .then((complaintId) => {
        setSubmitLoading(false);
        state.submitting = false;
        showSuccess(complaintId);
      })
      .catch(() => {
        setSubmitLoading(false);
        state.submitting = false;
        showSubmitError("We couldn't submit your report. Please check your connection and try again.");
      });
  }

  function isFreeTextCategory() {
    return !CATEGORY_CONFIG[state.problemType].options;
  }

  function mockSubmit() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const year = new Date().getFullYear();
        const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
        resolve(`KMB-year-{randomSeq}`);
      }, 1400);
    });
  }

  function setSubmitLoading(isLoading) {
    const labelEl = el.submitReportBtn.querySelector(".gt-btn-label");
    const loadingEl = el.submitReportBtn.querySelector(".gt-btn-loading");

    el.submitReportBtn.disabled = isLoading || !validateReportSilently();
    labelEl.classList.toggle("d-none", isLoading);
    loadingEl.classList.toggle("d-none", !isLoading);
  }

  // Used only to avoid re-triggering hint text updates while mid-submit.
  function validateReportSilently() {
    const hasPhoto = state.photoValid && !!state.photoFile;
    const hasProblemType = isProblemTypeComplete();
    const hasLocation = state.latitude !== null && state.longitude !== null;
    return hasPhoto && hasProblemType && hasLocation;
  }

  function showSubmitError(message) {
    el.submitErrorText.textContent = message;
    el.submitErrorAlert.classList.remove("d-none");
    showToast(message, "error");
  }

  function hideSubmitError() {
    el.submitErrorAlert.classList.add("d-none");
  }

  /* -----------------------------------------------------------
     21. SUCCESS SCREEN
     ----------------------------------------------------------- */

  function showSuccess(complaintId) {
    el.complaintIdText.textContent = complaintId;
    el.reportForm.classList.add("d-none");
    el.successScreen.classList.remove("d-none");
    el.reportProgress.querySelectorAll(".gt-progress-step").forEach((step) => {
      step.classList.add("is-active", "is-complete");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Report submitted successfully.", "success");
  }

  function setupSuccessActions() {
    el.reportAnotherBtn.addEventListener("click", resetReport);
    el.trackReportBtn.addEventListener("click", () => {
      // Placeholder until a tracking page/route exists.
      showToast("Report tracking is coming soon.", "info");
    });
  }

  /* -----------------------------------------------------------
     23. RESET
     ----------------------------------------------------------- */

  function resetReport() {
    window.location.href = window.location.pathname; // Reload without a query string → back to category chooser flow.
  }

  /* -----------------------------------------------------------
     TOASTS (used instead of browser alert())
     ----------------------------------------------------------- */

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `gt-toast gt-toast-${type}`;
    toast.setAttribute("role", "status");

    const iconClass = type === "error"
      ? "bi-exclamation-triangle-fill"
      : type === "success"
        ? "bi-check-circle-fill"
        : "bi-info-circle-fill";

    toast.innerHTML = `<i class="bi iconClass"></i><span>{escapeHtml(message)}</span>`;
    el.toastHost.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("is-visible"));

    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* -----------------------------------------------------------
     BOOT
     ----------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", initializeReportPage);
})();

