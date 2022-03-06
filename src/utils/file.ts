
export async function writeFile(data: Uint8Array) {
  // create a new handle
  const newHandle = await (<any>window).showSaveFilePicker();

  // create a FileSystemWritableFileStream to write to
  const writableStream = await newHandle.createWritable();

  // write our file
  await writableStream.write(data);

  // close the file and write the contents to disk.
  await writableStream.close();
}
