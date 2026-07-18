const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'node_modules', 'ao-network', 'libs');

// Patch 1: Deserializer — return null for unknown types
const deserializerPath = path.join(base, 'PhotonParser', 'Protocol16', 'Deserializer.js');
if (fs.existsSync(deserializerPath)) {
  let c = fs.readFileSync(deserializerPath, 'utf8');
  let patched = false;

  // Fix unknown type handler
  const oldDefault = "throw new Error(`Type code: ${typeCode} not implemented.`);";
  if (c.includes(oldDefault)) {
    c = c.replace(oldDefault, "return null;");
    patched = true;
  }

  // Fix parameter table to break on unknown types
  const oldParamTable = `deserializeParameterTable(input) {
        const dictionarySize = this.deserializeShort(input);
        let dictionary = {};

        for(let i = 0; i < dictionarySize; i++) {
            const key = input.ReadByte();
            const valueTypeCode = input.ReadByte();
            const value = this.deserializeHandler(input, valueTypeCode);

            dictionary[key] = value;
        }

        return dictionary;
    }`;

  const newParamTable = `deserializeParameterTable(input) {
        const dictionarySize = this.deserializeShort(input);
        let dictionary = {};

        for(let i = 0; i < dictionarySize; i++) {
            const key = input.ReadByte();
            const valueTypeCode = input.ReadByte();
            try {
                const value = this.deserializeHandler(input, valueTypeCode);
                dictionary[key] = value;
            } catch(e) {
                break;
            }
        }

        return dictionary;
    }`;

  if (c.includes(oldParamTable)) {
    c = c.replace(oldParamTable, newParamTable);
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(deserializerPath, c, 'utf8');
    console.log('[patch] Deserializer patched');
  } else {
    console.log('[patch] Deserializer already patched');
  }
}

// Patch 2: AODecoder — wrap deserialization in try-catch
const decoderPath = path.join(base, 'AODecoder.js');
if (fs.existsSync(decoderPath)) {
  let c = fs.readFileSync(decoderPath, 'utf8');

  const oldSwitch = `switch(messageType) {
            case this.messageType.OperationRequest:
                this.events.myEmit(
                    this.messageType.OperationRequest,
                    this.Deserializer.deserializeOperationRequest(payload)
                );
            break;

            case this.messageType.OperationResponse:
                this.events.myEmit(
                    this.messageType.OperationResponse,
                    this.Deserializer.deserializeOperationResponse(payload)
                );
            break;

            case this.messageType.Event:
                this.events.myEmit(
                    this.messageType.Event,
                    this.Deserializer.deserializeEventData(payload)
                );
            break;
        }`;

  const newSwitch = `try {
            switch(messageType) {
                case this.messageType.OperationRequest:
                    this.events.myEmit(
                        this.messageType.OperationRequest,
                        this.Deserializer.deserializeOperationRequest(payload)
                    );
                break;

                case this.messageType.OperationResponse:
                    this.events.myEmit(
                        this.messageType.OperationResponse,
                        this.Deserializer.deserializeOperationResponse(payload)
                    );
                break;

                case this.messageType.Event:
                    this.events.myEmit(
                        this.messageType.Event,
                        this.Deserializer.deserializeEventData(payload)
                    );
                break;
            }
        } catch(e) {}`;

  if (c.includes(oldSwitch)) {
    c = c.replace(oldSwitch, newSwitch);
    fs.writeFileSync(decoderPath, c, 'utf8');
    console.log('[patch] AODecoder patched');
  } else {
    console.log('[patch] AODecoder already patched');
  }
}
