export function browserSupport(): { usb: boolean; serial: boolean } {
  return { usb: "usb" in navigator, serial: "serial" in navigator };
}
