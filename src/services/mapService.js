export async function fetchMapData() {
  try {
    const response = await fetch(
      "https://lms-api.eternalpawcrematory.ph/api/lottag/0200201H-6A-4"
    );
    if (!response.ok) throw new Error("Failed to fetch map data");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}
