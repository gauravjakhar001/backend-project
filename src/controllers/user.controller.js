import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary ,deleteFromCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from "jsonwebtoken"
import mongoose from 'mongoose'



const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user  = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        //now we know that the accessToken is with the user but 
        // refresh token is within the database as it generates 
        // token by matching there
        user.refreshToken = refreshToken

        //ye isliye kyuki jb hmm save karate hai to 
        //monogoDb mey store sare chije kick in ho jati 
        //hai to password bhi mangta hai to hm phele hi bol
        //rhe hai ki hm jo kr rhe hai vo shi hai to
        // not required for validation
        await user.save({validateBeforeSave : false})

        return {accessToken , refreshToken}


    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token ")
    }
}

const registerUser = asyncHandler(async (req,res)=>{
  //get user details from frontend
  //validation -non empty
  //check if user already exists:username,email
  //check for images,check for avatar
  //uplaod them to cloudinary,avatar
  //create user obejct -create entry in db
  //remove password and refresh toke field from response 
  //check for user creation
  //return response 



  //get user details from frontend
  
  const {fullName,email,username,password} = req.body
   

    // if(fullName ===""){
    //     throw new ApiError(400,"Fullname is required")
    // }

    //aise bhi kr skte hai
    
     //validation -non empty
    if(
        [fullName,email,username,password].some((field)=>
        field?.trim() === "" )
    ){
        throw new ApiError(400,"All Fieds are required")
    }

    //check if user already exists:username,email
    const existedUser = await User.findOne({
        $or : [{ username } , { email } ]
    })
    

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists ")
    }


    //check for images,check for avatar
    const avatarLocalPath =  req.files?.avatar[0]?.path;
    //const coverImagePath =  req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required ")
    }


    //uplaod them to cloudinary,avatar

    const avatar =   await uploadOnCloudinary(avatarLocalPath)
    const coverImage =  await uploadOnCloudinary(coverImageLocalPath)


    if(!avatar){
        throw new ApiError(400,"Avatar file is required ")
    }

    //create user obejct -create entry in db

    const user  = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email, 
        password ,
        username : username.toLowerCase()
    })


     //remove password and refresh toke field from response

    const createdUser=  await User.findById(user._id).select(
        "-password -refreshToken"
    )

     //check for user creation
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    //return response 
    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered successfully")
    )


})

const loginUser = asyncHandler(async(req,res)=>{
    console.log("loginUser called");

         
//req body -> data 
//username or email 
//find the user
//password check
//access and refresh token 
//send cookie 


//req body -> data 
const {email,username, password} = req.body;
console.log("Error : ",email)

//username or email 
if(!username && !email){
    throw new ApiError(400,"Username or Email is required")
}

//find the user
const user  = await User.findOne({
    $or : [{username} ,{email}]
})

if(!user){
    throw new ApiError(404,"User does not exist")
}

//password check
 const isPasswordValid = await user.isPasswordCorrect(password)

 if(!isPasswordValid){
    throw new ApiError(401,"Invalid user credentials(Password is incorrect")
}

//access and refresh token 
const {accessToken , refreshToken} = await generateAccessAndRefreshTokens(user._id)

//(info that user will have after login )
  const loggedInUser =  await User.findById(user._id).select("-password -refreshToken")
 
  //send cookie 
  const options ={
    httpOnly :true,
    secure :true
  }

  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse( 200,{ user: loggedInUser,accessToken,refreshToken }, "User logged In Successfully" )
  )



})

const logoutUser = asyncHandler(async(req,res)=>{
   User.findByIdAndUpdate(
    req.user._id,
    {
        $set:{
            refreshToken : undefined
        }
    },
    { 
        new : true
    }
   )

   const options ={
    httpOnly :true,
    secure :true
  }

  return res.status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200, {},"User Logged Out Successfully"))


})

const refreshAccessToken = asyncHandler(async(req,res)=>{
   const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken , process.env.REFRESH_TOKEN_SECRET
        )
    
         const user = await User.findById(decodedToken?._id)
    
         if(!user){
             throw new ApiError(401,"Invalid refresh Token")
         }
    
         if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh Token is expired or used")
         }
    
         const options= {
            httpOnly :true,
            secure : true
         }
    
        const {accessToken , newrefreshToken}  = await generateAccessAndRefreshTokens(user._id)
    
         return res.status(200)
         .cookie("accessToken",accessToken,options)
         .cookie("refreshToken",newrefreshToken,options)
         .json(
            new ApiResponse(200,
                {accessToken , refreshToken : newrefreshToken},
                "Access Token refreshed"
            )
         )
    } catch (error) {
       throw new ApiError(401,error?.message || "Invalid Refresh Token")
    }

})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
   const {oldPassword , newPassword} = req.body

   const user = await User.findById(req.user?._id)
   const isPasswordCorrect =await user.isPasswordCorrect(oldPassword)

   if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid Old Passward")
   }

    user.password = newPassword
    await user.save({validateBeforeSave :false})

    return res.status(200)
    .json(new ApiResponse(200,{},"Password changes succesfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(200,req.user , " Current User fetched successfully")
})

const updateAccountDetails  = asyncHandler(async(req,res)=>{
    const {fullName ,email} = req.body

    if(!fullName || !email){
        throw new ApiError(400,"All fields are requied")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                // aise bhi de skte hai 
                fullName ,
                // or aise bhi de skte hai
                email : email
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Account details updated succesfully"))

});

const updateUserAvatar  = asyncHandler(async(req,res)=>{
    const avatarLocalPath  = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    //deleting an old Avatar 
    const oldUser  = await User.findById(req.user?._id)

    if(oldUser?.avatar_public_id){
        await deleteFromCloudinary(oldUser.avatar_public_id)
    }



    const avatar = await uploadOnCloudinary(avatarLocalPath)
  
    if(!avatar.url){
         throw new ApiError(400,"Error while uploading an avatar")
    }

     const user  = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                avatar : avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")



    return res.status(200)
    .json(
        new ApiResponse(200,user,"Avatar updated successfully")
    )

     

})

const updateUserCoverImage= asyncHandler(async(req,res)=>{
    const coverImagePath  = req.file?.path

    if(!coverImagePath){
        throw new ApiError(400,"CoverImage is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImagePath)

    if(!coverImage.url){
        throw new ApiError(400 ,"Error while uploading a coverImage")
    }

     const user  = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage : coverImage.url
            }
        },
        { new : true}
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200,user,"Cover Image updated successfully")
    )



})

const getUserChannelProfile = asyncHandler(async(req,res)=>{

    const {username} = req.params
    
    if(!username?.trim()){
        throw new ApiError(400,"Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match : {
                username : username.toLowerCase()
            }
        },
        {
                $lookup :{
                    from : "subscriptions",
                    localField: "_id",
                    // yha se subscritbers milenge
                    foreignField : "channel",
                    as: "subscribers"
                }

        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "",
                foreignField :"subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount  : {
                    $size : "$subscribers"
                },
                channelsSubscribedToCount : {
                    $size : "subscribedTo"
                },
                // ye button hai ye subscribe wala 
                isSubscribed : {
                    $cond : {
                        if : {$in : [req.user?._id, "$subscribers.subscriber"]},
                        then : true,
                        else : false
                    }
                }
            }
        },{
            $project :{
                fullName: 1,
                username :1,
                subscribersCount:1 ,
                channelsSubscribedToCount:1,
                isSubscribed :1,
                avatar :1,
                coverImage :1,
                email :1
            }
        }


       
    ])

    if(!channel?.length){
        throw new ApiError(404,"Channel doesn't exist")
    }
    console.log(channel);

    return res.status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel fetched successfully")
    )

})
 

const getWatchHistory =  asyncHandler(async(req,res)=>{
    const user  = await User.aggregate([
        {
           $match: {
                 _id: mongoose.Types.ObjectId.createFromHexString(req.user._id.toString())

        }

        },{
            $lookup :{
                from :"videos",
                localField : "watchHistory",
                foreignField: "_id",
                as : "watchHistory",
                pipeline:[
                    {
                        $lookup : {
                        from : "users",
                        localField : "owner",
                        foreignField : "_id",
                        as: "owner",
                        pipeline:[
                            {
                                $project:{
                                    fullName : 1,
                                    username : 1,
                                    avatar : 1
                                }
                            }
                        ]
                    }
                },
                {
                 $addFields : {
                    owner : {
                        $first: "$owner"
                    }
                 }   
                }
                ]
            }
        }
       
    ]);

     if (!user.length) {
        return res.status(404).json(
            new ApiResponse(404, [], "User not found or no watch history.")
        );
    }

    return res.status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "Watch History fetched successfully.")
    )
})



export{getCurrentUser,changeCurrentPassword,registerUser,loginUser,logoutUser,refreshAccessToken,updateUserAvatar,updateAccountDetails,updateUserCoverImage,getUserChannelProfile,getWatchHistory}