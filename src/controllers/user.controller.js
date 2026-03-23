import {asyncHandler} from "../utils/asyncHandler.js"

import { ApiError } from "../utils/ApiError.js";

import { User } from "../models/user.models.js";

import { uploadOnCloudinary } from "../utils/cloudinary.js"

import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler( async (req,res)=>{
    const { fullName, email, username, password}=req.body;
    if(
        [fullName,email,username,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400,"All field are required");
    }

    const userExist= User.findOne({
        $or:[{username},{email}]
    })
    if(userExist){
        throw new ApiError(409,"User already exists");
    }

    const avatarLocalPath= req.files?.avatar[0]?.path;
    const coverImageLocalPath= req.files?.coverImage[0]?.path;
    if(!avatarLocalPath){
        throw new ApiError(400,"avatar field is required")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
         throw new ApiError(400,"avatar field is required")
    };

    const user = await User.create({
        fullName,
        email,
        username:username.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url||"",
        password,
    })

    const createdUser= await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(createdUser){
        throw new ApiError(500,"SOmething goes wrong while registering user")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Successfully")
    )
} )

export {registerUser}