import React, { useState, useRef, useEffect } from "react";
import "./Form.css";
import { uploadToCloudinary } from "./cloudinary"; // keep your existing helper

/* =====================
   CONSTANT DATA
   ===================== */

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


  const handleLocationChange = (name, value) => {
    setLocation((p) => ({ ...p, [name]: value }));
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
      console.log("🔍 Checking nominee Aadhaar:", aadhaar);

      const res = await fetch(
        `http://localhost:8000/person/by-aadhaar/${aadhaar}`
      );

      // VERY IMPORTANT
      if (!res.ok) {
        console.log("ℹ️ Nominee Aadhaar not found in DB");
        return;
      }

      const data = await res.json();
      console.log("✅ Nominee exists as member:", data);

      setNomineeData(prev => ({
        ...prev,
        adhaarNumber: data.aadhaar_number,
        fullName: data.full_name || "",
        dob: data.dob || "",
        gender: data.gender || "",
        mobileNumber: data.mobile_number || "",
        education: data.education || "",
        profession: data.profession || "",
        religion: data.religion || "",
        reservation: data.reservation || "",
        caste: data.caste || ""
      }));

      console.log("🔁 Autofill mapping applied");

    } catch (err) {
      console.error("❌ Nominee Aadhaar check failed", err);
    }
  };

 const handleAadhaarOCR = async (file, owner) => {
   try {
    // 1️⃣ Upload to Cloudinary
     const imageUrl = await uploadToCloudinary(file);

    // 2️⃣ Call OCR API
     const res = await fetch("http://localhost:8000/ocr/aadhaar", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ image_url: imageUrl })
    });

     const ocr = await res.json();
     console.log("🧠 OCR RESULT:", ocr);

    // 3️⃣ NOMINEE → check DB first
     if (owner === "nominee") {
       const check = await fetch(
        ` http://localhost:8000/person/by-aadhaar/${ocr.aadhaar_number}`
       );

       if (check.ok) {
         const dbData = await check.json();
         console.log("🟢 Nominee exists → DB autofill");

         setNomineeData(dbData);
         return;
      }
    }

    // 4️⃣ OCR fallback autofill
     const autofill = {
       adhaarNumber: ocr.aadhaar_number,
       fullName: ocr.full_name,
       gender: ocr.gender,
       dob: ocr.dob,
       mobileNumber: ocr.mobile_number,
       pincode: ocr.pincode
    };

     owner === "member"
       ? setMemberData(p => ({ ...p, ...autofill }))
       : setNomineeData(p => ({ ...p, ...autofill }));

     console.log("🔁 OCR autofill applied");

   } catch (err) {
     console.error("OCR failed", err);
   }
};

  /* =====================
     SUBMIT
     ===================== */
  const handleSubmit = async () => {
    try {
      console.log("🧪 IMAGE STATE BEFORE UPLOAD", images);

      // 🔹 FLATTEN payload to match backend schema
      const payload = {
        // ---- member (main person) ----
        aadhaar_number: memberData.adhaarNumber,
        full_name: memberData.fullName,
        dob: memberData.dob,
        gender: memberData.gender,
        mobile_number: memberData.mobileNumber,
        pincode: location.pincode,

        education: memberData.education,
        profession: memberData.profession,
        religion: memberData.religion,
        reservation: memberData.reservation,
        caste: memberData.caste,

        membership: memberData.membership,
        membership_id: memberData.membershipId,

        // ---- location ----
        constituency: location.constituency,
        mandal: location.mandal,
        panchayathi: location.panchayathi,
        village: villageInput,
        ward_number: location.ward,
        latitude: location.latitude ? Number(location.latitude) : null,
        longitude: location.longitude ? Number(location.longitude) : null,

        // ---- images (Cloudinary URLs) ----
        aadhaar_image_url: images.member.aadhaarUrl || null,
        photo_url: images.member.photoUrl || null,


        // ---- nominee ----
        nominee_id: nomineeData.adhaarNumber
      };

      // 🟢 DEBUG PRINT (THIS IS WHAT YOU WANTED)
      console.log("📦 FINAL PAYLOAD (sent to backend)");
      console.log(JSON.stringify(payload, null, 2));

      // ❗STOP HERE while debugging
      // return;

      const res = await fetch("http://localhost:8000/person/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      alert("Saved successfully!");
      console.log("Backend response:", data);

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
          <div className="grid-2">
            <div>
              <label>Constituency Name</label>
              <input value={location.constituency} onChange={(e) => handleLocationChange("constituency", e.target.value)} />
            </div>

            <div>
              <label>Mandal Name</label>
              <select value={location.mandal} onChange={(e) => handleLocationChange("mandal", e.target.value)}>
                <option value="">Select</option>
                <option value="Mandal-1">Mandal-1</option>
                <option value="Mandal-2">Mandal-2</option>
              </select>
            </div>

            <div>
              <label>Panchayathi Name</label>
              <input value={location.panchayathi} onChange={(e) => handleLocationChange("panchayathi", e.target.value)} />
            </div>

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
                        // use onMouseDown to avoid blur before click
                        setVillageInput(v);
                        setShowVillageList(false);
                      }}
                    >
                      {v}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div>
              <label>pincode</label>
              <input value={location.pincode} onChange={(e) => handleLocationChange("pincode", e.target.value)} />
            </div>

            <div>
              <label>Ward Number</label>
              <input value={location.ward} onChange={(e) => handleLocationChange("ward", e.target.value)} />
            </div>

            <div>
              <label>Latitude</label>
              <input value={location.latitude} onChange={(e) => handleLocationChange("latitude", e.target.value)} />
            </div>

            <div>
              <label>Longitude</label>
              <input value={location.longitude} onChange={(e) => handleLocationChange("longitude", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid-2 gap">
          <UploadCard
            owner="member"
            onUpload={handleUpload}
            onAadhaarOCR={handleAadhaarOCR}
          />
          <UploadCard
            owner="nominee"
            onUpload={handleUpload}
            onAadhaarOCR={handleAadhaarOCR}
          />
        </div>

        <div className="grid-2 gap">
          <PersonCard title="Member Details" which="member" value={memberData} onChange={(d) => handlePersonChange("member", d)} />
          <PersonCard title="Nominee Details" which="nominee" value={nomineeData} onChange={(d) => handlePersonChange("nominee", d)} onAadhaarBlur={checkNomineeAadhaar} />
        </div>


        <div className="actions">
          <button className="btn primary" onClick={handleSubmit}>Submit</button>
          <button
            className="btn"
            onClick={() => {
              // reset everything
              setVillageInput("");
              setLocation({ constituency: "", mandal: "", panchayathi: "", ward: "", pincode: "", latitude: "", longitude: "" });
              setMemberData({});
              setNomineeData({});
              setImages({
                member: { aadhaarUrl: "", photoUrl: "", aadhaarPreview: "", photoPreview: "" },
                nominee: { aadhaarUrl: "", photoUrl: "", aadhaarPreview: "", photoPreview: "" }
              });
            }}
          >
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

function PersonCard({ title, which, value = {}, onChange, onAadhaarBlur }) {
  const [form, setForm] = useState({
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
    membershipId: "",
    ...value
  });

  useEffect(() => {
    // keep local form in sync when parent updates
    setForm((p) => ({ ...p, ...value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const { name, value: v } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: v };
      onChange && onChange(updated);
      return updated;
    });
  };

  const handleReservationChange = (e) => {
    const v = e.target.value;
    setForm((prev) => {
      const updated = { ...prev, reservation: v, caste: "" };
      onChange && onChange(updated);
      return updated;
    });
  };

  const handleMembershipChange = (e) => {
    const v = e.target.value;
    setForm((prev) => {
      const updated = { ...prev, membership: v, membershipId: v === "Yes" ? prev.membershipId : "" };
      onChange && onChange(updated);
      return updated;
    });
  };

  const casteOptions = CASTE_BY_RESERVATION[form.reservation] || [];
  
  
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
    if (which === "nominee" && onAadhaarBlur) {
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
        <select name="caste" value={form.caste} onChange={handleChange} disabled={!form.reservation}>
          <option value="">Select</option>
          {casteOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

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

function UploadCard({ owner = "member", onUpload, onAadhaarOCR }) {
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [aadhaarPreview, setAadhaarPreview] = useState("");

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [capturingFor, setCapturingFor] = useState(null); // "aadhaar" | "photo"

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      alert("Camera not accessible: " + err.message);
      setCapturingFor(null);
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
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => startCamera("aadhaar")}
              className="btn outline flex-1"
            >
              Take Photo
            </button>

            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              id={`${owner}-aadhaar-file`}
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
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}
