/**
 * Minimal Photon Protocol16 decoder for Albion Online market data.
 * Only decodes enough to identify auction operations and extract item listings.
 */

class PhotonStream {
  constructor(buf, offset = 0) {
    this.buf = buf;
    this.pos = offset;
  }

  readByte() {
    if (this.pos >= this.buf.length) throw new Error('EOF');
    return this.buf[this.pos++];
  }

  readInt16() {
    if (this.pos + 2 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readInt16BE(this.pos);
    this.pos += 2;
    return v;
  }

  readUint16() {
    if (this.pos + 2 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }

  readInt32() {
    if (this.pos + 4 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readInt32BE(this.pos);
    this.pos += 4;
    return v;
  }

  readUint32() {
    if (this.pos + 4 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readUInt32BE(this.pos);
    this.pos += 4;
    return v;
  }

  readFloat() {
    if (this.pos + 4 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readFloatBE(this.pos);
    this.pos += 4;
    return v;
  }

  readDouble() {
    if (this.pos + 8 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readDoubleBE(this.pos);
    this.pos += 8;
    return v;
  }

  readBytes(n) {
    if (this.pos + n > this.buf.length) throw new Error('EOF');
    const v = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return v;
  }

  readString() {
    const len = this.readUint16();
    if (len === 0) return '';
    return this.readBytes(len).toString('utf8');
  }

  skip(n) {
    this.pos += n;
  }

  remaining() {
    return this.buf.length - this.pos;
  }
}

// Photon type codes
const TYPE = {
  NULL: 0,
  BYTE: 98,       // 'b'
  DOUBLE: 100,    // 'd'
  EVENT_DATA: 101,// 'e'
  FLOAT: 102,     // 'f'
  HASHTABLE: 104, // 'h'
  INTEGER: 105,   // 'i'
  SHORT: 107,     // 'k'
  LONG: 108,      // 'l'
  BOOL: 111,      // 'o'
  OPS_RESPONSE: 112, // 'p'
  OPS_REQUEST: 113,  // 'q'
  STRING: 115,    // 's'
  BYTE_ARRAY: 120,// 'x'
  ARRAY: 121,     // 'y'
  OBJ_ARRAY: 122, // 'z'
  STRING_ARRAY: 97, // 'a'
  INT_ARRAY: 110,  // 'n'
  DICTIONARY: 68,  // 'D'
};

// Auction operation codes we care about
const AUCTION_OPS = new Set([75, 76, 89, 90]);
// MarketPlaceNotification event code
const MARKET_EVENT = 181;

const SENTINELS = new Set([999999, 1000000, 9999999, 99999999, 2147483647, 0]);
const MAX_PRICE = 50000000;

function isSentinel(v) {
  if (!v || v <= 0) return true;
  if (SENTINELS.has(v)) return true;
  if (v > MAX_PRICE) return true;
  return false;
}

/**
 * Try to decode a value from the stream given its type code.
 * Returns [value, success]. On failure, returns [null, false] without advancing stream too far.
 */
function decodeValue(stream, typeCode) {
  try {
    switch (typeCode) {
      case TYPE.NULL: return [null, true];
      case TYPE.BYTE: return [stream.readByte(), true];
      case TYPE.BOOL: return [stream.readByte() !== 0, true];
      case TYPE.SHORT: return [stream.readUint16(), true];
      case TYPE.INTEGER: return [stream.readInt32(), true];
      case TYPE.LONG: {
        const buf = stream.readBytes(8);
        return [Number(buf.readBigInt64BE(0)), true];
      }
      case TYPE.FLOAT: return [stream.readFloat(), true];
      case TYPE.DOUBLE: return [stream.readDouble(), true];
      case TYPE.STRING: return [stream.readString(), true];
      case TYPE.BYTE_ARRAY: {
        const count = stream.readInt32();
        return [stream.readBytes(count), true];
      }
      case TYPE.INT_ARRAY: {
        const count = stream.readInt32();
        const arr = [];
        for (let i = 0; i < count; i++) arr.push(stream.readInt32());
        return [arr, true];
      }
      case TYPE.STRING_ARRAY: {
        const count = stream.readInt32();
        const arr = [];
        for (let i = 0; i < count; i++) arr.push(stream.readString());
        return [arr, true];
      }
      case TYPE.ARRAY: {
        const len = stream.readUint16();
        const elemType = stream.readByte();
        if (elemType === TYPE.ARRAY) {
          const arr = [];
          for (let i = 0; i < len; i++) {
            const [v, ok] = decodeValue(stream, TYPE.ARRAY);
            arr.push(ok ? v : null);
          }
          return [arr, true];
        }
        if (elemType === TYPE.BYTE_ARRAY) {
          const arr = [];
          for (let i = 0; i < len; i++) {
            const [v, ok] = decodeValue(stream, TYPE.BYTE_ARRAY);
            arr.push(ok ? v : null);
          }
          return [arr, true];
        }
        const arr = [];
        for (let i = 0; i < len; i++) {
          const [v, ok] = decodeValue(stream, elemType);
          arr.push(ok ? v : null);
        }
        return [arr, true];
      }
      case TYPE.OBJ_ARRAY: {
        const len = stream.readUint16();
        const arr = [];
        for (let i = 0; i < len; i++) {
          const elemType = stream.readByte();
          const [v, ok] = decodeValue(stream, elemType);
          arr.push(ok ? v : null);
        }
        return [arr, true];
      }
      case TYPE.HASHTABLE: {
        const size = stream.readUint16();
        const obj = {};
        for (let i = 0; i < size; i++) {
          const kType = stream.readByte();
          const [key] = decodeValue(stream, kType);
          const vType = stream.readByte();
          const [val] = decodeValue(stream, vType);
          obj[key] = val;
        }
        return [obj, true];
      }
      case TYPE.DICTIONARY: {
        const keyType = stream.readByte();
        const valType = stream.readByte();
        const size = stream.readUint16();
        const obj = {};
        for (let i = 0; i < size; i++) {
          const kt = keyType === TYPE.NULL || keyType === 0 ? stream.readByte() : keyType;
          const [key] = decodeValue(stream, kt);
          const vt = valType === TYPE.NULL || valType === 0 ? stream.readByte() : valType;
          const [val] = decodeValue(stream, vt);
          obj[key] = val;
        }
        return [obj, true];
      }
      default:
        // Unknown type — can't decode, don't advance
        return [null, false];
    }
  } catch (e) {
    return [null, false];
  }
}

function decodeParameterTable(stream) {
  const count = stream.readUint16();
  const params = {};
  for (let i = 0; i < count; i++) {
    const key = stream.readByte();
    const typeCode = stream.readByte();
    const [value, ok] = decodeValue(stream, typeCode);
    if (!ok) break; // Can't decode further
    params[key] = value;
  }
  return params;
}

function decodeEvent(stream) {
  const code = stream.readByte();
  const params = decodeParameterTable(stream);
  return { code, params };
}

function decodeOperationResponse(stream) {
  const opCode = stream.readByte();
  const returnCode = stream.readInt16();
  const debugMsgType = stream.readByte();
  const [debugMsg] = decodeValue(stream, debugMsgType);
  const params = decodeParameterTable(stream);
  return { opCode, returnCode, debugMsg, params };
}

/**
 * Parse raw UDP payload and extract auction data.
 * Returns array of { itemId, price } objects, or empty array.
 */
function parsePhotonPacket(payload) {
  if (payload.length < 12) return [];

  const results = [];
  const stream = new PhotonStream(payload);

  // Photon header: peerId(2) + flags(1) + commandCount(1) + timestamp(4) + challenge(4)
  stream.skip(12);

  for (let cmdIdx = 0; cmdIdx < 10; cmdIdx++) { // max 10 commands per packet
    if (stream.remaining() < 12) break;

    const cmdType = stream.readByte();
    stream.skip(3); // channelId, commandFlags, unkBytes
    const cmdLength = stream.readUint32();
    stream.skip(4); // sequenceNumber

    const bodyLength = cmdLength - 12;
    if (bodyLength <= 0 || bodyLength > stream.remaining()) break;

    if (cmdType === 4) {
      // Disconnect
      break;
    }

    if (cmdType === 6 || cmdType === 7) {
      // SendReliable (6) or SendUnreliable (7)
      if (cmdType === 7) {
        stream.skip(4); // unreliable header
      }

      if (stream.remaining() < 2) break;
      stream.skip(1); // padding byte
      const msgType = stream.readByte();

      const msgPayload = new PhotonStream(payload, stream.pos);
      stream.skip(bodyLength - 2);

      try {
        if (msgType === 3) {
          // OperationResponse
          const resp = decodeOperationResponse(msgPayload);
          if (AUCTION_OPS.has(resp.opCode)) {
            extractAuctionData(resp.params, results);
          }
        } else if (msgType === 4) {
          // Event
          const evt = decodeEvent(msgPayload);
          if (evt.code === MARKET_EVENT) {
            extractAuctionData(evt.params, results);
          }
        } else {
          stream.skip(bodyLength - 2);
        }
      } catch (e) {
        // Skip this message
      }
      continue;
    }

    if (cmdType === 8) {
      // Fragment — skip for now
      stream.skip(bodyLength);
      continue;
    }

    // Unknown command type — skip
    stream.skip(bodyLength);
  }

  return results;
}

function extractAuctionData(params, results) {
  // Auction data comes as arrays of auction objects in the parameters.
  // The item list is typically in param key 248 or as an ObjectArray.
  // Each auction entry has: itemTypeId, quality, unitPrice, amount, auctionType

  for (const key of Object.keys(params)) {
    const val = params[key];
    if (!Array.isArray(val)) continue;

    for (const entry of val) {
      if (!entry || typeof entry !== 'object') continue;

      // Try named fields
      let itemId = entry.itemTypeId || entry.itemId;
      let price = entry.unitPrice || entry.price;
      let quality = entry.quality || 1;

      // Try numbered fields (Photon parameter keys)
      if (!itemId) {
        for (const k of Object.keys(entry)) {
          const v = entry[k];
          if (typeof v === 'string' && /^T[1-8]_/.test(v)) itemId = v;
        }
      }
      if (!price) {
        for (const k of Object.keys(entry)) {
          const v = entry[k];
          if (typeof v === 'number' && !isSentinel(v) && v >= 100) {
            price = v;
            break;
          }
        }
      }

      if (itemId && typeof itemId === 'string' && price && !isSentinel(price)) {
        results.push({
          itemId: itemId.replace(/@\d+$/, ''),
          quality: typeof quality === 'number' ? quality : 1,
          price: Number(price),
        });
      }
    }
  }
}

module.exports = { parsePhotonPacket, isSentinel, SENTINELS, MAX_PRICE };
