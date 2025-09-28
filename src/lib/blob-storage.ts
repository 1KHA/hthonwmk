import { uploadToSupabase, listSupabaseFiles, deleteFromSupabase } from './supabase-storage';

/**
 * Uploads a file to the blob storage (now using Supabase Storage)
 * @param file The file to upload
 * @param filename The name to give the file in storage
 * @param folder Optional folder path to organize files (e.g., 'teams', 'milestones')
 * @returns The URL of the uploaded file
 */
export async function uploadToBlob(file: File | Buffer, filename: string, folder: string = ''): Promise<string> {
  try {
    // Upload to Supabase Storage
    const url = await uploadToSupabase(file, filename, folder);
    return url;
  } catch (error) {
    console.error('Error uploading to blob storage:', error);
    throw new Error('Failed to upload file to blob storage');
  }
}

/**
 * Lists all files in a folder in the blob storage (now using Supabase Storage)
 * @param folder The folder to list files from
 * @returns Array of storage objects
 */
export async function listBlobFiles(folder: string = '') {
  try {
    const files = await listSupabaseFiles(folder);
    return files;
  } catch (error) {
    console.error('Error listing blob files:', error);
    throw new Error('Failed to list files from blob storage');
  }
}

/**
 * Deletes a file from the blob storage (now using Supabase Storage)
 * @param url The URL of the file to delete
 */
export async function deleteFromBlob(url: string) {
  try {
    // Extract the path from the URL for Supabase deletion
    const urlObj = new URL(url);
    const path = urlObj.pathname.substring(1); // Remove leading slash
    
    await deleteFromSupabase(path);
  } catch (error) {
    console.error('Error deleting from blob storage:', error);
    throw new Error('Failed to delete file from blob storage');
  }
}
