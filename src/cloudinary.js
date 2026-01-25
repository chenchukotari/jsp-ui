// src/cloudinary.js

export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "janasena_upload");


  const res = await fetch(
    "https://api.cloudinary.com/v1_1/ddtewwyny/image/upload",
    {
      method: "POST",
      body: formData
    }
  );

  const data = await res.json();

  if (!data.secure_url) {
    throw new Error("Cloudinary upload failed");
  }

  return data.secure_url; // text URL
}
