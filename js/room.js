let room;

async function initRoom() {
  room = new WebsimSocket();
  await Gallery.init();
  Editor.setup();
}

window.addEventListener('load', initRoom);