let room;

async function initRoom() {
  room = new WebsimSocket();
}

export { room, initRoom };