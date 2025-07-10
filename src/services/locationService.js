export function getCurrentLocation(
  options = { enableHighAccuracy: true, timeout: 5000 }
) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    }
  });
}

export function watchUserLocation(
  callback,
  errorCallback = console.error,
  options = { enableHighAccuracy: true, timeout: 5000 }
) {
  if (!navigator.geolocation) {
    errorCallback(new Error("Geolocation is not supported by your browser."));
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    callback,
    errorCallback,
    options
  );

  return watchId;
}

export function clearWatch(watchId) {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
}
