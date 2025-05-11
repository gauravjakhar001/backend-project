import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"

cloudinary.config({ 
        cloud_name: 'process.env.CLOUDINARY_CLOUD_NAME', 
        api_key: 'process.env.CLOUDINARY_API_KEY', 
        api_secret: 'process.env.CLOUDINARY_API_SECRET' // Click 'View API Keys' above to copy your API secret
    });




   const uploadOnCloudinary = async (localFielPath) => {
    try {
        if(!localFielPath) return null
        //upload the file on cloudinary 
        const response  = await cloudinary.uploader.upload(localFielPath,{
            resource_type : "auto"
        })

        //file has been uploaded successfully 
        console.log("File is Uploaded Successfully on Cloudinary",
            response.url);
        return response;
        
    } catch (error) {
        fs.unlink(localFielPath)//remove the locally stoes temporary file as the upload operation got failed
        return null
        
    }

   }

