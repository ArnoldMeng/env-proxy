
import zlib from 'zlib'

/**
 * 根据Content-Encoding消息头确定解码方式，处理完数据之后再编码回去
 * @param oriBuffer
 * @param encoding 消息头中的编码格式
 */
export function handleBuffer(oriBuffer: Buffer, encoding: string) {
  let decodeMethod: string = '';
  let encodeMethod: string = '';
  // 编码格式介绍：https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Content-Encoding
  switch (encoding) {
      case 'gzip':
          decodeMethod = 'gunzipSync';
          encodeMethod = 'gzipSync';
          break;
      case 'deflate':
          decodeMethod = 'inflateSync';
          encodeMethod = 'deflateSync';
          break;
      case 'br':
          decodeMethod = 'brotliDecompressSync';
          encodeMethod = 'brotliCompressSync';
          break;
      default:
          break;
  }
  let decodeBuffer: Buffer = oriBuffer;
  if (decodeMethod && encodeMethod) {
      decodeBuffer = zlib[decodeMethod](oriBuffer);
  }
  return decodeMethod && encodeMethod ? decodeBuffer : oriBuffer;
}