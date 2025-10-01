import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create a Supabase client with the service role key for server-side operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// Create a Supabase client with the anon key for client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Bucket name for milestone submissions
const BUCKET_NAME = 'newbuk';

/**
 * Uploads a file to Supabase Storage
 * @param file The file to upload
 * @param filename The name to give the file in storage
 * @param folder Optional folder path to organize files (e.g., 'milestones')
 * @returns The URL of the uploaded file
 */
export async function uploadToSupabase(file: File | Buffer, filename: string, folder: string = ''): Promise<string> {
  try {
    // Create a path with folder if provided
    const path = folder ? `${folder}/${filename}` : filename;
    
    // If file is a Buffer, we need to convert it to a Blob
    let blob: Blob;
    if (Buffer.isBuffer(file)) {
      // Convert Buffer to Uint8Array which is a valid BlobPart
      blob = new Blob([new Uint8Array(file)]);
    } else {
      // If it's already a File (which extends Blob), use it directly
      blob = file;
    }
    
    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .upload(path, blob, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading to Supabase Storage:', error);
      throw new Error(`Failed to upload file to Supabase Storage: ${error.message}`);
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw new Error('Failed to upload file to Supabase Storage');
  }
}

/**
 * Lists all files in a folder in Supabase Storage
 * @param folder The folder to list files from
 * @returns Array of storage objects
 */
export async function listSupabaseFiles(folder: string = '') {
  try {
    const { data, error } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .list(folder);
    
    if (error) {
      console.error('Error listing Supabase Storage files:', error);
      throw new Error(`Failed to list files from Supabase Storage: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error listing Supabase Storage files:', error);
    throw new Error('Failed to list files from Supabase Storage');
  }
}

/**
 * Deletes a file from Supabase Storage
 * @param path The path of the file to delete
 */
export async function deleteFromSupabase(path: string) {
  try {
    const { error } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      console.error('Error deleting from Supabase Storage:', error);
      throw new Error(`Failed to delete file from Supabase Storage: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting from Supabase Storage:', error);
    throw new Error('Failed to delete file from Supabase Storage');
  }
}

/**
 * Generates a signed URL for client-side uploads
 * @param filename The name to give the file in storage
 * @param folder Optional folder path to organize files (e.g., 'milestones')
 * @returns Object containing the signed URL and other upload details
 */
export async function getSignedUploadUrl(filename: string, folder: string = '') {
  try {
    // Create a path with folder if provided
    const path = folder ? `${folder}/${filename}` : filename;
    
    console.log(`Generating signed URL for path: ${path}`);
    
    // Generate a signed URL with options
    const { data, error } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(path, {
        upsert: false
      });
    
    if (error) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
    
    console.log('Signed URL generated successfully:', data);
    
    // Get the public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);
    
    return {
      signedUrl: data.signedUrl,
      path: data.path,
      publicUrl
    };
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate signed URL');
  }
}
