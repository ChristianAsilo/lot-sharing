export async function fetchMapData(lotId) {
  try {
    if (lotId.trim() != "") {
      const response = await fetch(
        `https://lms-api.eternalpawcrematory.ph/api/lottag/${lotId}`
      );
      if (!response.ok) throw new Error("Failed to fetch map data");
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}
