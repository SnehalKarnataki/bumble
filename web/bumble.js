class PacketSource {
    constructor(pyodide) {
        this.parser = pyodide.runPython(`
        from bumble.transport.common import PacketParser
        class ProxiedPacketParser(PacketParser):
            def feed_data(self, js_data):
                super().feed_data(bytes(js_data.to_py()))
        ProxiedPacketParser()
      `);
    }

    set_packet_sink(sink) {
        this.parser.set_packet_sink(sink);
    }

    data_received(data) {
        this.parser.feed_data(data);
    }
}

class PacketSink {
    constructor(writer) {
        this.writer = writer;
    }

    on_packet(packet) {
        const buffer = packet.toJs();
        console.log(`$$$ on_packet: ${bufferToHex(buffer)}`);
        // TODO: create an async queue here instead of blindly calling write without awaiting
        this.writer(buffer);
        packet.destroy();
    }
}

async function connectWebSocket(pyodide, hciWsUrl) {
    return new Promise((resolve, reject) => {
        let resolved = false;

        let ws = new WebSocket(hciWsUrl);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            console.log("WebSocket open");
            resolve({
                packet_source,
                packet_sink
            });
            resolved = true;
        }

        ws.onclose = () => {
            console.log("WebSocket close");
            if (!resolved) {
                reject(`Failed to connect to ${hciWsUrl}`)
            }
        }

        ws.onmessage = (event) => {
            console.log(`WebSocket message: ${bufferToHex(event.data)}`);
            packet_source.data_received(event.data);
        }

        const packet_source = new PacketSource(pyodide);
        const packet_sink = new PacketSink((packet) => ws.send(packet));
    })
}

async function loadBumble(pyodide, bumbleModule) {
      // Load the Bumble module
      await pyodide.loadPackage("micropip");
      await pyodide.runPythonAsync(`
        import micropip
        await micropip.install("${bumbleModule}")
        package_list = micropip.list()
        print(package_list)
      `)
}