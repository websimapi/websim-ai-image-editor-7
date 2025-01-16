let room;

async function initRoom() {
  room = new WebsimSocket();
  return room;
}

export { room, initRoom };