/**
 * Photon Protocol18 decoder for Albion Online market data.
 * Architecture based on AODP source analysis:
 *   - Market data comes as JSON strings in the OperationResponse "debug message" slot
 *   - Operation codes live in params[253], event codes in params[252]
 *   - When debug message is a string[] (type 71), there is NO parameter table after it
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

  readInt16LE() {
    if (this.pos + 2 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  readUint16LE() {
    if (this.pos + 2 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readUInt16LE(this.pos);
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

  readFloatLE() {
    if (this.pos + 4 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }

  readDoubleLE() {
    if (this.pos + 8 > this.buf.length) throw new Error('EOF');
    const v = this.buf.readDoubleLE(this.pos);
    this.pos += 8;
    return v;
  }

  readBytes(n) {
    if (this.pos + n > this.buf.length) throw new Error('EOF');
    const v = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return v;
  }

  readVarint32() {
    let value = 0;
    for (let shift = 0; shift <= 28; shift += 7) {
      const b = this.readByte();
      value |= (b & 0x7F) << shift;
      if ((b & 0x80) === 0) {
        return value >>> 0;
      }
    }
    throw new Error('Varint32 overflow');
  }

  readVarint64() {
    let value = 0n;
    for (let shift = 0n; shift <= 63n; shift += 7n) {
      const b = BigInt(this.readByte());
      value |= (b & 0x7Fn) << shift;
      if ((b & 0x80n) === 0n) {
        return value;
      }
    }
    throw new Error('Varint64 overflow');
  }

  readString() {
    const len = this.readVarint32();
    if (len === 0) return '';
    return this.readBytes(len).toString('utf8');
  }

  skip(n) {
    this.pos += n;
  }

  remaining() {
    return this.buf.length - this.pos;
  }

  hexDump(n) {
    const end = Math.min(this.pos + n, this.buf.length);
    return Array.from(this.buf.slice(this.pos, end))
      .map(b => b.toString(16).padStart(2, '0')).join(' ');
  }
}

// Protocol18 ZigZag decode
function zigZagDecode32(value) {
  return (value >>> 1) ^ -(value & 1);
}

function zigZagDecode64(value) {
  return (value >> 1n) ^ -(value & 1n);
}

// Protocol18 type codes
const TYPE = {
  UNKNOWN:            0,
  BOOLEAN:            2,
  BYTE:               3,
  SHORT:              4,
  FLOAT:              5,
  DOUBLE:             6,
  STRING:             7,
  NULL:               8,
  COMPRESSED_INT:     9,
  COMPRESSED_LONG:    10,
  INT1:               11,
  INT1_NEG:           12,
  INT2:               13,
  INT2_NEG:           14,
  LONG1:              15,
  LONG1_NEG:          16,
  LONG2:              17,
  LONG2_NEG:          18,
  CUSTOM:             19,
  DICTIONARY:         20,
  HASHTABLE:          21,
  OBJECT_ARRAY:       23,
  EVENT_DATA:         26,
  BOOLEAN_FALSE:      27,
  BOOLEAN_TRUE:       28,
  SHORT_ZERO:         29,
  INT_ZERO:           30,
  LONG_ZERO:          31,
  FLOAT_ZERO:         32,
  DOUBLE_ZERO:        33,
  BYTE_ZERO:          34,
  ARRAY:              64,
  INT_ARRAY:          65,
  BOOLEAN_ARRAY:      66,
  BYTE_ARRAY:         67,
  SHORT_ARRAY:        68,
  FLOAT_ARRAY:        69,
  DOUBLE_ARRAY:       70,
  STRING_ARRAY:       71,
  COMPRESSED_INT_ARRAY:  73,
  COMPRESSED_LONG_ARRAY: 74,
  OBJECT_ARRAY_ARRAY: 82,
  CUSTOM_TYPE_ARRAY:  83,
  DICTIONARY_ARRAY:   84,
  HASHTABLE_ARRAY:    85,
  CUSTOM_TYPE_SLIM:   128,
};

// ── Albion operation/event codes (from AODP source) ──
// Market auction operations — codes found in params[253]
const AUCTION_OPS = new Set([81, 82, 83, 95, 174, 176, 250]);
// Join response (location tracking)
const JOIN_OP = 2;
// MarketPlaceNotification event code — found in params[252]
const MARKET_EVENT = 183;

const SENTINELS = new Set([999999, 1000000, 9999999, 99999999, 2147483647, 0]);
const MAX_PRICE = 50000000;

function isSentinel(v) {
  if (!v || v <= 0) return true;
  if (SENTINELS.has(v)) return true;
  if (v > MAX_PRICE) return true;
  return false;
}

// ── Location tracking ──
const LOCATION_NAMES = {
  3003: 'Brecilien',
  3004: 'Caerleon',
  3005: 'Bridgewatch',
  3006: 'Fort Sterling',
  3007: 'Lymhurst',
  3008: 'Martlock',
  3009: 'Thetford',
  499:  'Black Market',
};

let _currentLocationId = 3004; // default Caerleon
let _currentLocationName = 'Caerleon';

function getCurrentLocation() {
  return { id: _currentLocationId, name: _currentLocationName };
}

function setLocation(locationId) {
  if (typeof locationId !== 'number') locationId = Number(locationId);
  if (!locationId || locationId <= 0) return;
  _currentLocationId = locationId;
  _currentLocationName = LOCATION_NAMES[locationId] || `City(${locationId})`;
}

/**
 * Decode a value from the stream given its Protocol18 type code.
 * Returns [value, success]. On failure, returns [null, false].
 */
function decodeValue(stream, typeCode) {
  try {
    switch (typeCode) {
      case TYPE.UNKNOWN:
      case TYPE.NULL:
        return [null, true];
      case TYPE.BOOLEAN_FALSE:
        return [false, true];
      case TYPE.BOOLEAN_TRUE:
        return [true, true];
      case TYPE.SHORT_ZERO:
        return [0, true];
      case TYPE.INT_ZERO:
        return [0, true];
      case TYPE.LONG_ZERO:
        return [0n, true];
      case TYPE.FLOAT_ZERO:
        return [0.0, true];
      case TYPE.DOUBLE_ZERO:
        return [0.0, true];
      case TYPE.BYTE_ZERO:
        return [0, true];

      case TYPE.BYTE:
        return [stream.readByte(), true];
      case TYPE.BOOLEAN:
        return [stream.readByte() !== 0, true];
      case TYPE.SHORT:
        return [stream.readInt16LE(), true];
      case TYPE.FLOAT:
        return [stream.readFloatLE(), true];
      case TYPE.DOUBLE:
        return [stream.readDoubleLE(), true];
      case TYPE.STRING:
        return [stream.readString(), true];

      case TYPE.COMPRESSED_INT: {
        const raw = stream.readVarint32();
        return [zigZagDecode32(raw), true];
      }
      case TYPE.COMPRESSED_LONG: {
        const raw = stream.readVarint64();
        return [Number(zigZagDecode64(raw)), true];
      }

      case TYPE.INT1:
        return [stream.readByte(), true];
      case TYPE.INT1_NEG:
        return [-stream.readByte(), true];
      case TYPE.INT2:
        return [stream.readUint16LE(), true];
      case TYPE.INT2_NEG:
        return [-stream.readUint16LE(), true];
      case TYPE.LONG1:
        return [stream.readByte(), true];
      case TYPE.LONG1_NEG:
        return [-stream.readByte(), true];
      case TYPE.LONG2:
        return [stream.readUint16LE(), true];
      case TYPE.LONG2_NEG:
        return [-stream.readUint16LE(), true];

      case TYPE.CUSTOM: {
        const typeId = stream.readByte();
        const len = stream.readVarint32();
        const data = stream.readBytes(len);
        return [{ custom: true, typeId, data: Array.from(data) }, true];
      }

      case TYPE.HASHTABLE:
        return decodeHashtable(stream);
      case TYPE.DICTIONARY:
        return decodeDictionary(stream);
      case TYPE.OBJECT_ARRAY:
      case TYPE.ARRAY:
        return decodeObjectArray(stream);

      case TYPE.INT_ARRAY:
        return decodeIntArray(stream);
      case TYPE.BYTE_ARRAY:
        return decodeByteArray(stream);
      case TYPE.SHORT_ARRAY:
        return decodeShortArray(stream);
      case TYPE.FLOAT_ARRAY:
        return decodeFloatArray(stream);
      case TYPE.DOUBLE_ARRAY:
        return decodeDoubleArray(stream);
      case TYPE.STRING_ARRAY:
        return decodeStringArray(stream);
      case TYPE.BOOLEAN_ARRAY:
        return decodeBooleanArray(stream);
      case TYPE.COMPRESSED_INT_ARRAY:
        return decodeCompressedIntArray(stream);
      case TYPE.COMPRESSED_LONG_ARRAY:
        return decodeCompressedLongArray(stream);
      case TYPE.HASHTABLE_ARRAY:
        return decodeHashtableArray(stream);
      case TYPE.DICTIONARY_ARRAY:
        return decodeDictionaryArray(stream);
      case TYPE.CUSTOM_TYPE_ARRAY:
        return decodeCustomTypeArray(stream);
      case TYPE.OBJECT_ARRAY_ARRAY:
        return decodeObjectArrayArray(stream);

      default:
        if (typeCode >= TYPE.CUSTOM_TYPE_SLIM) {
          const typeId = typeCode - TYPE.CUSTOM_TYPE_SLIM;
          const len = stream.readUint16LE();
          const data = stream.readBytes(len);
          return [{ custom: true, typeId, data: Array.from(data) }, true];
        }
        return [null, false];
    }
  } catch (e) {
    return [null, false];
  }
}

// ── Array decoders ──

function decodeObjectArray(stream) {
  const size = stream.readVarint32();
  if (size > 100000) return [null, false];
  const arr = [];
  for (let i = 0; i < size; i++) {
    const elemType = stream.readByte();
    const [v] = decodeValue(stream, elemType);
    arr.push(v);
  }
  return [arr, true];
}

function decodeIntArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(stream.readInt32());
  }
  return [arr, true];
}

function decodeByteArray(stream) {
  const size = stream.readVarint32();
  return [stream.readBytes(size), true];
}

function decodeShortArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(stream.readInt16LE());
  }
  return [arr, true];
}

function decodeFloatArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(stream.readFloatLE());
  }
  return [arr, true];
}

function decodeDoubleArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(stream.readDoubleLE());
  }
  return [arr, true];
}

function decodeStringArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(stream.readString());
  }
  return [arr, true];
}

function decodeBooleanArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  const fullBytes = Math.floor(size / 8);
  let idx = 0;
  for (let i = 0; i < fullBytes; i++) {
    const b = stream.readByte();
    for (let bit = 0; bit < 8 && idx < size; bit++) {
      arr.push((b & (1 << bit)) !== 0);
      idx++;
    }
  }
  const remainder = size % 8;
  if (remainder > 0) {
    const b = stream.readByte();
    for (let bit = 0; bit < remainder; bit++) {
      arr.push((b & (1 << bit)) !== 0);
    }
  }
  return [arr, true];
}

function decodeCompressedIntArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    const raw = stream.readVarint32();
    arr.push(zigZagDecode32(raw));
  }
  return [arr, true];
}

function decodeCompressedLongArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    const raw = stream.readVarint64();
    arr.push(Number(zigZagDecode64(raw)));
  }
  return [arr, true];
}

function decodeHashtable(stream) {
  const size = stream.readVarint32();
  return decodeHashtableElements(stream, size, 0, 0);
}

function decodeDictionary(stream) {
  const keyType = stream.readByte();
  const valType = stream.readByte();
  const size = stream.readVarint32();
  return decodeHashtableElements(stream, size, keyType, valType);
}

function decodeHashtableElements(stream, count, keyTypeCode, valTypeCode) {
  const obj = {};
  for (let i = 0; i < count; i++) {
    const kt = (keyTypeCode === 0 || keyTypeCode === TYPE.NULL) ? stream.readByte() : keyTypeCode;
    const [key] = decodeValue(stream, kt);
    const vt = (valTypeCode === 0 || valTypeCode === TYPE.NULL) ? stream.readByte() : valTypeCode;
    const [val] = decodeValue(stream, vt);
    if (key !== null) obj[key] = val;
  }
  return [obj, true];
}

function decodeHashtableArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    const [v] = decodeValue(stream, TYPE.HASHTABLE);
    arr.push(v);
  }
  return [arr, true];
}

function decodeDictionaryArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    const [v] = decodeValue(stream, TYPE.DICTIONARY);
    arr.push(v);
  }
  return [arr, true];
}

function decodeCustomTypeArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    const [v] = decodeValue(stream, TYPE.CUSTOM);
    arr.push(v);
  }
  return [arr, true];
}

function decodeObjectArrayArray(stream) {
  const size = stream.readVarint32();
  const arr = [];
  for (let i = 0; i < size; i++) {
    const [v] = decodeValue(stream, TYPE.OBJECT_ARRAY);
    arr.push(v);
  }
  return [arr, true];
}

// ── Protocol18 parameter table (1-byte count) ──

function decodeParameterTable(stream) {
  const count = stream.readByte();
  const params = {};
  for (let i = 0; i < count; i++) {
    const key = stream.readByte();
    const typeCode = stream.readByte();
    const [value, ok] = decodeValue(stream, typeCode);
    if (!ok) break;
    params[key] = value;
  }
  return params;
}

// ── Event decoding ──

function decodeEvent(stream) {
  const code = stream.readByte();
  const params = decodeParameterTable(stream);
  return { code, params };
}

// ── OperationResponse decoding (AODP architecture) ──
// opCode(1) + returnCode(int16 LE) + debugType(byte) + debugValue
// If debugValue is string[] (type 71): market data — NO param table follows
// Otherwise: read param table normally

function decodeOperationResponse(stream) {
  const opCode = stream.readByte();
  const returnCode = stream.readInt16LE();
  const debugType = stream.readByte();
  const [debugMsg, debugOk] = decodeValue(stream, debugType);

  // AODP: when debug message is a string array, it IS the market data
  // and there is no parameter table after it
  if (debugOk && Array.isArray(debugMsg) && debugMsg.length > 0 &&
      typeof debugMsg[0] === 'string') {
    return { opCode, returnCode, debugMsg, params: {}, isMarketData: true };
  }

  // Otherwise: read parameter table normally
  const params = decodeParameterTable(stream);
  return { opCode, returnCode, debugMsg, params, isMarketData: false };
}

let _debug = false;
function dbg(...args) { if (_debug) console.log('[photon]', ...args); }

// Fragment reassembly buffer
const _fragBufs = new Map();
const MAX_FRAG_AGE_MS = 10000;

function decodeMessage(msgPayload) {
  if (msgPayload.remaining() < 2) return null;
  msgPayload.skip(1); // padding/signifier byte
  const rawMsgType = msgPayload.readByte();
  const msgType = rawMsgType & 0x7F;

  if (msgType === 3) {
    return { type: 'opResponse', data: decodeOperationResponse(msgPayload) };
  } else if (msgType === 4) {
    return { type: 'event', data: decodeEvent(msgPayload) };
  }
  return null;
}

// ── Location name mapping ──
function getLocationName(id) {
  return LOCATION_NAMES[id] || `City(${id})`;
}

function handleMessage(msg, results) {
  if (!msg) return;

  if (msg.type === 'opResponse') {
    const resp = msg.data;

    // Extract the REAL Albion opCode from params[253]
    const albionOpCode = resp.params[253] !== undefined ? resp.params[253] : resp.opCode;

    // Location tracking: Join response opCode=2 has locationId in params[8]
    if (resp.opCode === JOIN_OP || albionOpCode === JOIN_OP) {
      const locId = resp.params[8];
      if (locId) {
        setLocation(locId);
        dbg(`    >>> JOIN: location=${_currentLocationName} (${_currentLocationId})`);
      }
    }

    dbg(`    opResponse: header=${resp.opCode} albion=${albionOpCode} returnCode=${resp.returnCode} isMarket=${resp.isMarketData}`);

    // Market data in debug message slot (string[] of JSON orders)
    if (resp.isMarketData && resp.debugMsg && resp.debugMsg.length > 0) {
      dbg(`    >>> MARKET DATA (debug slot): ${resp.debugMsg.length} items, opCode=${albionOpCode}`);
      extractMarketOrders(resp.debugMsg, albionOpCode, results);
      return;
    }

    // Auction operations via params[253]
    if (AUCTION_OPS.has(albionOpCode)) {
      dbg(`    >>> AUCTION OP ${albionOpCode}! params keys: [${Object.keys(resp.params).join(',')}]`);
      extractAuctionData(resp.params, albionOpCode, results);
    }

  } else if (msg.type === 'event') {
    const evt = msg.data;

    // Extract the REAL Albion event code from params[252]
    const albionCode = evt.params[252] !== undefined ? evt.params[252] : evt.code;

    dbg(`    event: header=${evt.code} albion=${albionCode} n=${Object.keys(evt.params).length}`);

    if (albionCode === MARKET_EVENT) {
      dbg(`    >>> MARKET EVENT ${albionCode}! params keys: [${Object.keys(evt.params).join(',')}]`);
      extractAuctionData(evt.params, albionCode, results);
    }
  }
}

// ── Parse JSON market orders from debug slot ──
// Each string in the array is a JSON-encoded market order:
// {Id, ItemTypeId, ItemGroupTypeId, LocationId, QualityLevel,
//  EnchantmentLevel, UnitPriceSilver, Amount, AuctionType, Expires}

function extractMarketOrders(stringArray, opCode, results) {
  const loc = getCurrentLocation();
  let parsed = 0;
  let failed = 0;

  for (const raw of stringArray) {
    if (typeof raw !== 'string') continue;
    try {
      const order = JSON.parse(raw);

      const itemId = order.ItemTypeId;
      const price = order.UnitPriceSilver;
      const quality = order.QualityLevel || 1;
      const enchant = order.EnchantmentLevel || 0;
      const amount = order.Amount || 1;
      const auctionType = order.AuctionType || 'offer';
      const locationId = order.LocationId;
      const expires = order.Expires;

      if (!itemId || !price || isSentinel(price)) continue;

      // Strip enchantment suffix from item ID (e.g. "T4_BAG@3" -> "T4_BAG")
      const cleanItemId = itemId.replace(/@\d+$/, '');

      results.push({
        itemId: cleanItemId,
        quality,
        price: Number(price),
        amount,
        auctionType,
        locationId: locationId || loc.id,
        locationName: getLocationName(locationId || loc.id),
        enchant,
        expires,
        source: 'market_json',
        opCode,
      });
      parsed++;
    } catch (e) {
      failed++;
    }
  }

  if (parsed > 0 || failed > 0) {
    dbg(`    market orders: ${parsed} parsed, ${failed} failed, city=${_currentLocationName}`);
  }
}

// ── Fallback: extract from params hashtable (older format) ──

function extractAuctionData(params, opCode, results) {
  for (const key of Object.keys(params)) {
    const val = params[key];
    if (!Array.isArray(val)) continue;

    for (const entry of val) {
      if (!entry || typeof entry !== 'object') continue;

      let itemId = entry.itemTypeId || entry.ItemTypeId || entry.itemId;
      let price = entry.unitPrice || entry.UnitPriceSilver || entry.price;
      let quality = entry.quality || entry.QualityLevel || 1;
      let auctionType = entry.auctionType || entry.AuctionType || 'offer';
      let amount = entry.amount || entry.Amount || 1;

      if (!itemId) {
        for (const k of Object.keys(entry)) {
          const v = entry[k];
          if (typeof v === 'string' && /^T[1-8]_/.test(v)) { itemId = v; break; }
        }
      }
      if (!price) {
        for (const k of Object.keys(entry)) {
          const v = entry[k];
          if (typeof v === 'number' && !isSentinel(v) && v >= 100) { price = v; break; }
        }
      }

      if (itemId && typeof itemId === 'string' && price && !isSentinel(price)) {
        const loc = getCurrentLocation();
        results.push({
          itemId: itemId.replace(/@\d+$/, ''),
          quality: typeof quality === 'number' ? quality : 1,
          price: Number(price),
          amount: typeof amount === 'number' ? amount : 1,
          auctionType,
          locationId: loc.id,
          locationName: loc.name,
          enchant: 0,
          source: 'params_hashtable',
          opCode,
        });
      }
    }
  }
}

/**
 * Parse raw UDP payload and extract auction data.
 */
function parsePhotonPacket(payload) {
  if (payload.length < 12) return [];

  const results = [];
  const stream = new PhotonStream(payload);

  // Photon header: peerId(2) + flags(1) + commandCount(1) + timestamp(4) + challenge(4)
  stream.skip(2);
  stream.skip(1);
  const numCmds = stream.readByte();
  stream.skip(8);

  for (let cmdIdx = 0; cmdIdx < numCmds; cmdIdx++) {
    if (stream.remaining() < 12) break;

    const cmdType = stream.readByte();
    const chId = stream.readByte();
    const cmdFlags = stream.readByte();
    const reserved = stream.readByte();
    const cmdLength = stream.readUint32();
    const seqNum = stream.readUint32();

    const bodyLength = cmdLength - 12;
    if (bodyLength <= 0 || bodyLength > stream.remaining()) break;

    if (cmdType === 4) break;

    if (cmdType === 6 || cmdType === 7) {
      if (cmdType === 7) {
        stream.skip(4); // unreliable header
      }

      const msgPayload = new PhotonStream(payload, stream.pos);
      stream.skip(bodyLength - (cmdType === 7 ? 4 : 0));

      try {
        const msg = decodeMessage(msgPayload);
        handleMessage(msg, results);
      } catch (e) {
        dbg(`    decode error: ${e.message}`);
      }
      continue;
    }

    if (cmdType === 8) {
      if (bodyLength < 20) {
        stream.skip(bodyLength);
        continue;
      }

      const startSeq = stream.readUint32();
      const fragCount = stream.readUint32();
      const fragNum = stream.readUint32();
      const totalLen = stream.readUint32();
      const opLen = stream.readUint32();
      const fragPayloadLen = bodyLength - 20;
      const fragPayload = stream.readBytes(fragPayloadLen);

      let entry = _fragBufs.get(startSeq);
      if (!entry) {
        entry = { chunks: new Map(), totalFragments: fragCount, totalLength: totalLen, operationLength: opLen, created: Date.now() };
        _fragBufs.set(startSeq, entry);
      }
      entry.chunks.set(fragNum, fragPayload);

      if (entry.chunks.size === entry.totalFragments) {
        const chunks = [];
        for (let i = 0; i < entry.totalFragments; i++) {
          const chunk = entry.chunks.get(i);
          if (!chunk) break;
          chunks.push(chunk);
        }
        _fragBufs.delete(startSeq);

        if (chunks.length === entry.totalFragments) {
          const reassembled = Buffer.concat(chunks);
          try {
            const msgPayload = new PhotonStream(reassembled);
            const msg = decodeMessage(msgPayload);
            handleMessage(msg, results);
          } catch (e) {
            dbg(`    reassembled decode error: ${e.message}`);
          }
        }
      }
      continue;
    }

    stream.skip(bodyLength);
  }

  // Cleanup old fragments
  const now = Date.now();
  for (const [key, entry] of _fragBufs) {
    if (now - entry.created > MAX_FRAG_AGE_MS) {
      _fragBufs.delete(key);
    }
  }

  return results;
}

function setDebug(on) { _debug = on; }

module.exports = { parsePhotonPacket, setDebug, isSentinel, SENTINELS, MAX_PRICE, getCurrentLocation, getLocationName, LOCATION_NAMES };
