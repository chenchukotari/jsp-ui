import React, { useState, useRef, useEffect } from "react";
import "./Form.css";
import { uploadToCloudinary } from "./cloudinary"; // keep your existing helper

/* =====================
   CONSTANT DATA
   ===================== */

const API_BASE_URL = "https://jsp-backend-1.onrender.com";

const VILLAGE_NAMES = [
  "Muchivolu",
  "Bokkasam Palem",
  "Munipalle",
  "Muthukur",
  "Madanapalle",
  "Chintalapudi",
  "Chandragiri",
  "Kalikiri",
  "Kavali",
  "Kodur",
  "Nellore",
  "Naidupeta"
].sort();

const GENDER_OPTIONS = ["Male", "Female", "Others"];

const EDUCATION_OPTIONS = [
  "Illiterate",
  "Below SSC",
  "SSC",
  "Intermediate",
  "Bachelors Degree",
  "Master Degree",
  "PHD"
];

const PROFESSION_OPTIONS = [
  "Government Job",
  "Private Sector",
  "Business / Self Employed",
  "Farmer",
  "Daily Labourer",
  "Electrician",
  "Driver",
  "Doctor",
  "Software Engineer"
];

const RELIGION_OPTIONS = [
  "Hindu",
  "Muslim",
  "Christian",
  "Sikh",
  "Jain",
  "Buddhism",
  "Others"
];

const RESERVATION_OPTIONS = [
  "ST",
  "SC",
  "OC / GENERAL",
  "BC-A",
  "BC-B",
  "BC-C",
  "BC-D",
  "BC-E",
  "Others"
];

const CASTE_BY_RESERVATION = {
  ST: ["Mala", "Madiga"],
  SC: ["Yanadhi", "Sugali"],
  "OC / GENERAL": ["OC-1", "OC-2"],
  "BC-A": ["BC-A-1", "BC-A-2"],
  "BC-B": ["BC-B-1", "BC-B-2"],
  "BC-C": ["BC-C-1"],
  "BC-D": ["BC-D-1"],
  "BC-E": ["BC-E-1"],
  Others: ["Other-1", "Other-2"]
};

/* =====================
   MAIN FORM
   ===================== */

export default function JanasenaForm() {
  // Location & village autocomplete
  const [villageInput, setVillageInput] = useState("");
  const [showVillageList, setShowVillageList] = useState(false);
  const [formKey, setFormKey] = useState(0); // Forcing re-mount on reset
  const [memberExists, setMemberExists] = useState(false);
  const [memberExistsData, setMemberExistsData] = useState(null);

  const filteredVillages = VILLAGE_NAMES.filter((v) =>
    v.toLowerCase().startsWith(villageInput.toLowerCase())
  );

  // Other location fields
  const [location, setLocation] = useState({
    constituency: "",
    mandal: "",
    panchayathi: "",
    pincode: "",
    ward: "",
    latitude: "",
    longitude: ""
  });

  // Lifted person data
  const [memberData, setMemberData] = useState({});

  const [nomineeData, setNomineeData] = useState({
    adhaarNumber: "",
    fullName: "",
    dob: "",
    gender: "",
    mobileNumber: "",
    education: "",
    profession: "",
    religion: "",
    reservation: "",
    caste: "",
    membership: "No",
    membershipId: ""
  });


  // Images state keyed by owner: 'member' or 'nominee'
  const [images, setImages] = useState({
    member: {
      aadhaarFile: "",     // ✅ REAL File object
      photoFile: "",       // ✅ REAL File object
      aadhaarPreview: "",
      photoPreview: ""
    },
    nominee: {
      aadhaarFile: "",
      photoFile: "",
      aadhaarPreview: "",
      photoPreview: ""
    }
  });

  // OCR Loading state
  const [ocrLoading, setOcrLoading] = useState({ member: false, nominee: false });

  // Geography lookup status
  const [geoStatus, setGeoStatus] = useState("");

  const handleLocationChange = (name, value) => {
    setLocation((p) => ({ ...p, [name]: value }));
  };

  const geographyLookup = async (villageName) => {
    if (!villageName || !villageName.trim()) return;
    try {
      setGeoStatus("Loading...");
      const res = await fetch(
        `${API_BASE_URL}/geography/lookup/${encodeURIComponent(villageName.trim())}`
      );
      if (res.status === 404) {
        setGeoStatus("Village not found");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log("🌍 Geography lookup result:", data);

      // Auto-fill location fields
      setLocation((p) => ({
        ...p,
        panchayathi: data.panchayati_name || data.panchayathi_name || "",
        mandal: data.mandal_name || "",
        constituency: data.constituency_name || "",
        pincode: data.pincode || ""
        // ward stays empty, user enters manually
      }));

      setGeoStatus("Address fields auto-filled");
    } catch (err) {
      console.error("Geography lookup failed", err);
      setGeoStatus("Error: " + err.message);
    }
  };

  const handlePersonChange = (which, data) => {
    if (which === "member") setMemberData(data);
    else setNomineeData(data);
  };

  const handleUpload = (which, payload) => {
    // payload: { aadhaarUrl?, photoUrl?, aadhaarPreview?, photoPreview? }
    console.log("📥 Image received in parent:", which, payload);

    setImages((p) => ({
      ...p,
      [which]: { ...p[which], ...payload }
    }));
  };

  const checkNomineeAadhaar = async (aadhaar) => {
    if (!aadhaar || aadhaar.length !== 12) return;
    try {
      await checkPersonExists(aadhaar, "nominee");
    } catch (err) {
      console.error("❌ Nominee Aadhaar check failed", err);
    }
  };

  // Helper: map backend person shape to our frontend person object
  const mapBackendToPerson = (d) => ({
    adhaarNumber: d.aadhaar_number || d.aadhaar || "",
    fullName: d.full_name || d.fullName || "",
    dob: d.dob || "",
    gender: d.gender || "",
    mobileNumber: d.mobile_number || d.mobile || "",
    education: d.education || "",
    profession: d.profession || "",
    religion: d.religion || "",
    reservation: d.reservation || "",
    caste: d.caste || "",
    membership: d.membership || "No",
    membershipId: d.membership_id || d.membershipId || ""
  });

  // Normalize Aadhaar helper
  const normalizeAadhaar = (s) => (s || "").replace(/\D/g, "");

  // Check existence endpoint and act depending on target (member/nominee)
  const checkPersonExists = async (aadhaar, target = "member") => {
    const digits = normalizeAadhaar(aadhaar || "");
    if (!digits) return null;
    if (digits.length !== 12) {
      // invalid aadhaar — clear memberExists when checking member
      if (target === "member") {
        setMemberExists(false);
        setMemberExistsData(null);
      }
      return null;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/person/exists/${encodeURIComponent(digits)}`);
      // expect backend to return JSON like { exists: true/false, member: { ... } }
      const j = await res.json().catch(() => null);
      if (!j || !j.exists) {
        if (target === "member") {
          setMemberExists(false);
          setMemberExistsData(null);
        }
        return j || null;
      }

      // exists === true
      const member = j.member || j; // support both shapes
      if (target === "member") {
        setMemberExists(true);
        setMemberExistsData(member);
      }

      if (target === "nominee" && member) {
        // populate nominee fields from member returned
        const person = mapBackendToPerson(member);
        setNomineeData((prev) => ({ ...prev, ...person }));
      }

      return j;
    } catch (err) {
      console.error("checkPersonExists failed", err);
      return null;
    }
  };

  const handleAadhaarOCR = async (file, owner) => {
    try {
      setOcrLoading(prev => ({ ...prev, [owner]: true }));
      console.log(`Using API: ${API_BASE_URL}`);

      // 1️⃣ Upload to Cloudinary
      const imageUrl = await uploadToCloudinary(file);
      console.log("✅ Aadhaar uploaded:", imageUrl);

      // 🔥 FIX: Update state with the uploaded URL
      setImages((p) => ({
        ...p,
        [owner]: { ...p[owner], aadhaarUrl: imageUrl }
      }));

      // 2️⃣ Call OCR API
      const formData = new FormData();
      formData.append("file", file); // Send the raw file

      const res = await fetch(`${API_BASE_URL}/ocr-parse`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`OCR API failed with status: ${res.status}`);
      }

      const ocrResponse = await res.json();
      console.log("🧠 OCR RESULT:", ocrResponse);

      // Map backend response 'extracted' to our needs
      // Backend returns: { extracted: { name, dob, address, aadhaar, gender } }
      const ocr = ocrResponse.extracted || {};

      // Clean up aadhaar number (remove spaces)
      const aadhaarClean = ocr.aadhaar ? ocr.aadhaar.replace(/\s/g, "") : "";

      // Check existence for both member and nominee flows
      if (aadhaarClean) {
        await checkPersonExists(aadhaarClean, owner === "nominee" ? "nominee" : "member");
      }

      // 4️⃣ OCR fallback autofill
      const autofill = {
        adhaarNumber: aadhaarClean,
        fullName: ocr.name,
        gender: ocr.gender,
        dob: ocr.dob,
        // mobileNumber: ocr.mobile_number, // Backend extraction doesn't seem to return mobile number reliably currently
        // pincode: ocr.pincode // Backend extraction currently returns full address string, logic might need adjustment if pincode is needed
      };

      if (owner === "member") {
        setMemberData(p => ({ ...p, ...autofill }));
        // Also update global location pincode if we can extract it from address
        // Simple primitive check for pincode in address if available
        if (ocr.address) {
          const pinMatch = ocr.address.match(/\b\d{6}\b/);
          if (pinMatch) {
            setLocation(p => ({ ...p, pincode: pinMatch[0] }));
          }
        }
      } else {
        setNomineeData(p => ({ ...p, ...autofill }));
      }

      console.log("🔁 OCR autofill applied");


    } catch (err) {
      console.error("OCR failed", err);
      alert("OCR parsing failed: " + err.message);
    } finally {
      setOcrLoading(prev => ({ ...prev, [owner]: false }));
    }
  };

  const handleReset = () => {
    // reset everything
    setVillageInput("");
    setLocation({
      constituency: "",
      mandal: "",
      panchayathi: "",
      ward: "",
      pincode: "",
      latitude: "",
      longitude: ""
    });
    setMemberData({});
    setNomineeData({});
    setImages({
      member: { aadhaarUrl: "", photoUrl: "", aadhaarPreview: "", photoPreview: "" },
      nominee: { aadhaarUrl: "", photoUrl: "", aadhaarPreview: "", photoPreview: "" }
    });
    setGeoStatus("");
    setFormKey(prev => prev + 1);
  };

  /* =====================
     SUBMIT
     ===================== */
  const handleSubmit = async () => {
    try {
      console.log("🧪 IMAGE STATE BEFORE UPLOAD", images);

      const formatDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
      };

      const payload = {
        aadhaar_number: memberData.adhaarNumber || "",
        full_name: memberData.fullName || "",
        dob: formatDate(memberData.dob),
        gender: memberData.gender || "",
        mobile_number: memberData.mobileNumber || "",
        pincode: location.pincode || "",

        education: memberData.education || "",
        profession: memberData.profession || "",
        religion: memberData.religion || "",
        reservation: memberData.reservation || "",
        caste: memberData.caste || "",

        membership: memberData.membership || "No",
        membership_id: memberData.membershipId || "",

        constituency: location.constituency || "",
        mandal: location.mandal || "",
        panchayathi: location.panchayathi || "",
        village: villageInput || "",
        ward_number: location.ward || "",

        aadhaar_image_url: images.member.aadhaarUrl || null,
        photo_url: images.member.photoUrl || null,

        nominee_id: nomineeData.adhaarNumber || ""
      };

      console.log("📦 FINAL PAYLOAD", payload);

      const res = await fetch(`${API_BASE_URL}/person/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("✅ Submitted, resetting form", data);
      handleReset();
      alert("Submitted successfully!");
    } catch (err) {
      console.error(err);
      alert("Submit failed: " + err.message);
    }
  };


  return (
    <div className="page">
      <div className="form-card">
        <div className="header">Janasena Membership & Accident Insurance Form</div>

        <p className="subtitle">Please provide accurate details for both Member and Nominee</p>

        {/* Location */}
        <div className="section">
          <div className="grid-3">
            {/* First row: Village/Town Name, Ward Number, pincode */}
            {/* Village Autocomplete */}
            <div style={{ position: "relative" }}>
              <label>Village/Town Name</label>
              <input
                value={villageInput}
                onChange={(e) => {
                  setVillageInput(e.target.value);
                  setShowVillageList(true);
                }}
                onFocus={() => setShowVillageList(true)}
                onBlur={() => setTimeout(() => setShowVillageList(false), 150)}
              />

              {showVillageList && (
                <ul className="autocomplete-list">
                  {filteredVillages.map((v) => (
                    <li
                      key={v}
                      onMouseDown={(ev) => {
                        setVillageInput(v);
                        setShowVillageList(false);
                        geographyLookup(v);
                      }}
                    >
                      {v}
                    </li>
                  ))}
                </ul>
              )}
              {geoStatus && <small style={{ color: "#666", marginTop: "4px", display: "block" }}>{geoStatus}</small>}
            </div>

            <div>
              <label>Ward Number</label>
              <input value={location.ward} onChange={(e) => handleLocationChange("ward", e.target.value)} />
            </div>

            <div>
              <label>pincode</label>
              <input value={location.pincode} onChange={(e) => handleLocationChange("pincode", e.target.value)} />
            </div>

            {/* Second row: Panchayathi Name, Mandal Name, Constituency Name */}
            <div>
              <label>Panchayathi Name</label>
              <input value={location.panchayathi} onChange={(e) => handleLocationChange("panchayathi", e.target.value)} />
            </div>

            <div>
              <label>Mandal Name</label>
              <input value={location.mandal} onChange={(e) => handleLocationChange("mandal", e.target.value)} />
            </div>

            <div>
              <label>Constituency Name</label>
              <input value={location.constituency} onChange={(e) => handleLocationChange("constituency", e.target.value)} />
            </div>

            {/* Latitude and Longitude Removed */}
          </div>
        </div>

        <div className="grid-2 gap">
          <UploadCard
            key={`member-${formKey}`}
            owner="member"
            onUpload={handleUpload}
            onAadhaarOCR={handleAadhaarOCR}
            isScanning={ocrLoading.member}
          />
          <UploadCard
            key={`nominee-${formKey}`}
            owner="nominee"
            onUpload={handleUpload}
            onAadhaarOCR={handleAadhaarOCR}
            isScanning={ocrLoading.nominee}
          />
        </div>

        <div className="grid-2 gap">
          <PersonCard key={`member-card-${formKey}`} title="Member Details" which="member" value={memberData} onChange={(d) => handlePersonChange("member", d)} onAadhaarBlur={(aadhaar) => checkPersonExists(aadhaar, "member")} />
          <PersonCard key={`nominee-card-${formKey}`} title="Nominee Details" which="nominee" value={nomineeData} onChange={(d) => handlePersonChange("nominee", d)} onAadhaarBlur={(aadhaar) => checkPersonExists(aadhaar, "nominee")} />
        </div>


        {memberExists && (
          <div style={{ padding: '8px 12px', background: '#fff7cc', borderRadius: 8, marginBottom: 12, border: '1px solid #f59e0b' }}>
            ⚠️ This person is already registered as a member.
          </div>
        )}

        <div className="actions">
          <button className="btn primary" onClick={handleSubmit} disabled={memberExists} style={memberExists ? { opacity: 0.6, cursor: 'not-allowed' } : {}}>
            Submit
          </button>
          <button className="btn" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================
   PERSON CARD (controlled + lifted)
   ===================== */

const INITIAL_PERSON_STATE = {
  fullName: "",
  adhaarNumber: "",
  dob: "",
  mobileNumber: "",
  gender: "",
  education: "",
  profession: "",
  religion: "",
  reservation: "",
  caste: "",
  membership: "No",
  membershipId: ""
};

function PersonCard({ title, which, value = {}, onChange, onAadhaarBlur }) {
  const [form, setForm] = useState({
    ...INITIAL_PERSON_STATE,
    ...value
  });

  useEffect(() => {
    // keep local form in sync when parent updates
    // MERGE with INITIAL_PERSON_STATE to ensure reset works when value is {}
    setForm((p) => ({ ...INITIAL_PERSON_STATE, ...value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const { name, value: v } = e.target;
    // ensure we keep the structure
    const updated = { ...form, [name]: v };
    setForm(updated);
    onChange && onChange(updated);
  };

  const handleReservationChange = (e) => {
    const v = e.target.value;
    const updated = { ...form, reservation: v, caste: "" };
    setForm(updated);
    onChange && onChange(updated);
  };

  const handleMembershipChange = (e) => {
    const v = e.target.value;
    const updated = { ...form, membership: v, membershipId: v === "Yes" ? form.membershipId : "" };
    setForm(updated);
    onChange && onChange(updated);
  };

  /* Removed unused casteOptions variable assignment */

  return (
    <div className="card">
      <div className="card-header">{title}</div>

      <div className="card-body">
        <label>Full Name</label>
        <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="Enter full name" />

        <label>DOB & Gender</label>
        <div className="row">
          <input name="dob" value={form.dob} onChange={handleChange} placeholder="DD/MM/YYYY" />
          <select name="gender" value={form.gender} onChange={handleChange}>
            <option value="">Gender</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <label>Adhaar Number</label>
        <input
          name="adhaarNumber"
          value={form.adhaarNumber}
          onChange={handleChange}
          onBlur={() => {
            if (onAadhaarBlur) {
              onAadhaarBlur(form.adhaarNumber);
            }
          }}
          placeholder="Enter Adhaar number"
        />

        <label>Mobile Number</label>
        <input name="mobileNumber" value={form.mobileNumber} onChange={handleChange} placeholder="Enter mobile number" />

        <label>Qualification</label>
        <select name="education" value={form.education} onChange={handleChange}>
          <option value="">Select</option>
          {EDUCATION_OPTIONS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <label>Profession</label>
        <select name="profession" value={form.profession} onChange={handleChange}>
          <option value="">Select</option>
          {PROFESSION_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <label>Religion</label>
        <select name="religion" value={form.religion} onChange={handleChange}>
          <option value="">Select</option>
          {RELIGION_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <label>Reservation</label>
        <select name="reservation" value={form.reservation} onChange={handleReservationChange}>
          <option value="">Select</option>
          {RESERVATION_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <label>Caste</label>
        <input name="caste" value={form.caste} onChange={handleChange} placeholder="Enter Caste" />


        <label>Janasena Membership & ID</label>
        <div className="row">
          <select name="membership" value={form.membership} onChange={handleMembershipChange}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>

          <input
            name="membershipId"
            placeholder="XXXX XXXX XXXX XXXX"
            value={form.membershipId}
            onChange={handleChange}
            disabled={form.membership !== "Yes"}
          />
        </div>
      </div>
    </div>
  );
}

/* =====================
   UPLOAD CARD (handles both Aadhaar + Photo for owner)
   ===================== */

function UploadCard({ owner = "member", onUpload, onAadhaarOCR, isScanning }) {
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [aadhaarPreview, setAadhaarPreview] = useState("");

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [capturingFor, setCapturingFor] = useState(null); // "aadhaar" | "photo"
  const [facingMode, setFacingMode] = useState("user"); // "user" | "environment"

  useEffect(() => {
    // cleanup on unmount
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  /* ================= CAMERA ================= */

  const startCamera = async (type) => {
    setCapturingFor(type);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      alert("Camera not accessible: " + err.message);
      setCapturingFor(null);
    }
  };

  const switchCamera = async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);

    // Stop current stream
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
    }

    // Restart with new mode
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Switch failed", err);
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const file = new File([blob], `${owner}-${capturingFor}.png`, {
        type: "image/png",
      });
      const previewUrl = URL.createObjectURL(blob);

      if (capturingFor === "aadhaar") {
        setAadhaarFile(file);
        setAadhaarPreview(previewUrl);

        // 🔥 Aadhaar must go through OCR
        onAadhaarOCR(file, owner);
      } else {
        setPhotoFile(file);
        setPhotoPreview(previewUrl);
        await uploadAndNotify(file, "photo", previewUrl);
      }
    });

    // Stop camera
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCapturingFor(null);
  };

  /* ================= FILE HANDLING ================= */

  const handlePhotoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreview(preview);

    await uploadAndNotify(file, "photo", preview);
  };

  const uploadAndNotify = async (file, type, previewUrl = "") => {
    try {
      console.log("⏫ Upload started:", { owner, type, file: file.name });

      const url = await uploadToCloudinary(file);

      console.log("✅ Upload success:", url);

      if (onUpload) {
        if (type === "photo") {
          onUpload(owner, { photoUrl: url, photoPreview: previewUrl });
        }
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Image upload failed: " + err.message);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="card p-4 shadow rounded-lg max-w-sm mx-auto">
      <div className="card-body">
        {/* ================= AADHAAR ================= */}
        <div className="mb-4">
          <div className="font-semibold mb-2">
            Aadhaar Document ({owner})
            {isScanning && <span style={{ marginLeft: 10, color: '#f59e0b' }}>Processing... ⏳</span>}
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => startCamera("aadhaar")}
              className="btn outline flex-1"
              disabled={isScanning}
            >
              Take Photo
            </button>

            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              id={`${owner}-aadhaar-file`}
              disabled={isScanning}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const preview = URL.createObjectURL(file);
                setAadhaarFile(file);
                setAadhaarPreview(preview);

                // 🔥 Aadhaar always goes to OCR
                onAadhaarOCR(file, owner);
              }}
            />

            <label
              htmlFor={`${owner}-aadhaar-file`}
              className="btn outline flex-1 cursor-pointer text-center"
              style={isScanning ? { pointerEvents: "none", opacity: 0.5 } : {}}
            >
              Choose File
            </label>
          </div>

          {aadhaarPreview && (
            <div
              className="border rounded p-1 flex justify-center items-center"
              style={{ height: 180 }}
            >
              <img
                src={aadhaarPreview}
                alt="Aadhaar Preview"
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
        </div>

        {/* ================= PHOTO ================= */}
        <div className="mb-4">
          <div className="font-semibold mb-2">Photo ({owner})</div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => startCamera("photo")}
              className="btn outline flex-1"
            >
              Take Photo
            </button>

            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              id={`${owner}-photo-file`}
              onChange={handlePhotoFileChange}
            />

            <label
              htmlFor={`${owner}-photo-file`}
              className="btn outline flex-1 cursor-pointer text-center"
            >
              Choose File
            </label>
          </div>

          {photoPreview && (
            <div
              className="border rounded p-1 flex justify-center items-center"
              style={{ height: 180 }}
            >
              <img
                src={photoPreview}
                alt="Photo Preview"
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
        </div>

        {/* ================= CAMERA PREVIEW ================= */}
        {capturingFor && (
          <div className="mt-2 border rounded p-1">
            <video
              ref={videoRef}
              style={{ width: "100%", borderRadius: 4 }}
            />
            <button
              onClick={capturePhoto}
              className="btn outline w-full mt-2"
            >
              Capture
            </button>
            <button
              onClick={switchCamera}
              className="btn outline w-full mt-2"
              style={{ borderColor: "#10b981", color: "#10b981" }}
            >
              Switch Camera ({facingMode === "user" ? "Front" : "Back"})
            </button>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}
