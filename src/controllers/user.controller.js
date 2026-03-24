import {asyncHandler} from "../utils/asyncHandler.js"

import { ApiError } from "../utils/ApiError.js";

import { User } from "../models/user.models.js";

import { uploadOnCloudinary } from "../utils/cloudinary.js"

import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessAndRefreshToken= async (userId)=>{
    try{
    const user= await User.findOne(userId)
    const accessToken= user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken=refreshToken
    await user.save({validateBeforeSave:false})

    return {accessToken, refreshToken}
    }
    catch(error){
        throw new ApiError(500,"Something went wrong while generating refresh token")
    }
} 

const registerUser = asyncHandler( async (req,res)=>{
    const { fullName, email, username, password}=req.body;
    if(
        [fullName,email,username,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400,"All field are required");
    }

    const userExist= await User.findOne({
        $or:[{username},{email}]
    })
    if(userExist){
        throw new ApiError(409,"User already exists");
    }

    const avatarLocalPath= req.files?.avatar[0]?.path;
    // const coverImageLocalPath= req.files?.coverImage[0]?.path;
    if(!avatarLocalPath){
        throw new ApiError(400,"avatar field is required")
    }
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage)&&req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
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
    if(!createdUser){
        throw new ApiError(500,"S0mething goes wrong while registering user")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Successfully")
    )
} )

const loginUser= asyncHandler(async (req,res)=>{
    const {email, username, password}=req.body
    if(!username|| !email){
        throw new ApiError(400,"Username or email is required")
    }
    const user= await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }

    const validPassword= await user.isPasswordCorrect(password)
    if(!validPassword){
        throw new ApiError(401, "Invalid Password")
    }
    const {accessToken, refreshToken}= generateAccessAndRefreshToken(user._id)

    const loggedIn = await User.findOne(user._id).select(
        "-password -refreshToken"
    )
    const options ={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedIn, accessToken,refreshToken

            },
            "User logged in Successfully"
        )
    )


})

const logoutUser= asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    ) 

    const options ={
        httpOnly:true,
        secure:true
    }

    return res.status(200).clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(200, {},"User logged out")
})

export {registerUser,loginUser,logoutUser}