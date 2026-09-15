import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, encodePng } from './png.ts';

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });
});

describe('encodePng', () => {
  it('writes a valid RGB PNG', () => {
    const rgb = Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);

    const png = encodePng(2, 2, rgb);

    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]]).toEqual([2, 2, 8, 2]);

    const idatLength = png.readUInt32BE(33);
    expect(png.toString('ascii', 37, 41)).toBe('IDAT');
    expect([...inflateSync(png.subarray(41, 41 + idatLength))]).toEqual([
      0, 255, 0, 0, 0, 255, 0,
      0, 0, 0, 255, 255, 255, 255,
    ]);
    expect(png.subarray(-12).toString('hex')).toBe('0000000049454e44ae426082');
  });

  it('refuses pixel data of the wrong size', () => {
    expect(() => encodePng(2, 2, new Uint8Array(5))).toThrow('Expected 12 bytes');
  });
});
