import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt, { decode } from "jsonwebtoken"
import mongoose from "mongoose";
import { subscription } from "../models/subscription.models.js";


const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password } = req.body
    //console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

const loginUser = asyncHandler(async (req, res) =>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const { email, username, password} = req.body
    

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken= asyncHandler(async(req,res)=>{
    const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken= jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user= await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401, "Invalid Refresh token")
        }
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
        const {newAccessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
        const options={
            httpOnly:true,
            secure:true
        }
        return res.status(200)
        .cookie("accessToken",newAccessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {newAccessToken,refreshToken : newRefreshToken},
                "Access token generated"
            )
        )
    
    } catch (error) {
        throw new ApiError(401,"Something went wrong while generating access token")
    }
})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, currentPassword}= req.body

    const user= await User.findById(req.user?._id)
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400, "Wrong Password")

    }
    user.password= currentPassword
    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(new ApiError(200,{},"Password changed succesfully"))
})

const getCurrentUser= asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(new ApiResponse(200,req.user,"current User fetch successfully"))
})

const updateDetails= asyncHandler(async(req,res)=>{
    const {fullName,email}= req.body

    if(!fullName || !email){
        throw new ApiError(400, "Both field is required")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {
            new:true
        }

    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Details updated successfully"))

})

const updateAvatar= asyncHandler(async (req,res)=>{
    const avatarLocalPath= req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar Files is not present")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar?.url){
        throw new ApiError(400,"API error while uploading avatar")
    }
    // const currentUser= await User.findById(req.user._id)

    // if(currentUser?.avatar){
    //     try {
    //         const 
    //     } catch (error) {
            
    //     }
    // }





    const user= await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    )
    return res.status(200)
    .json(new ApiResponse(200,user,"Avatar uploaded successfully"))
})

const updateCoverImage= asyncHandler(async (req,res)=>{
    const coverImageLocalPath= req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image Files is not present")
    }

    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"API error while uploading cover image")
    }
    const user= await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    )

    return res.status(200)
    .json(new ApiResponse(200,user,"Cover Image uploaded successfully"))
})

const getUserChannelProfile= asyncHandler(async(req,res)=>{

    const username= req.params

    if(!username?.trim()){
        throw new ApiError(400,"missing username")

    }

    const channel = User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
           
        },
        {
            $lookup:{
                from:"_id",
                localField:"subscriptions", // In monogDB Subscription saves as subscriptions
                foreignField:"channel",
                save:"subscribers"
            }
        },
        {
            $lookup:{
                from:"_id",
                localField:"subscriptions", // In monogDB Subscription saves as subscriptions
                foreignField:"subscriber",
                save:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,subscribers.subscriber]},
                        then: true,
                        else :false
                    }
                }
            }
        },
        {
            $project:{
                username:1,
                fullName:1,
                email:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,

            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel does not exist")
    }

    return res.status(200)
    .json(
        new ApiResponse(200,channel[0],"channel data fetched successfully")
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateDetails,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,

}





// import {asyncHandler} from "../utils/asyncHandler.js"

// import { ApiError } from "../utils/ApiError.js";

// import { User } from "../models/user.models.js";

// import { uploadOnCloudinary } from "../utils/cloudinary.js"

// import { ApiResponse } from "../utils/ApiResponse.js"
// import { verifyJWT } from "../middlewares/auth.middleware.js";

// import jwt from "jsonwebtoken"

// const generateAccessAndRefreshToken= async (userId)=>{
//     try{
//     const user= await User.findOne(userId)
//     const accessToken= user.generateAccessToken()
//     const refreshToken = user.generateRefreshToken()

//     user.refreshToken=refreshToken
//     await user.save({validateBeforeSave:false})

//     return {accessToken, refreshToken}
//     }
//     catch(error){
//         throw new ApiError(500,"Something went wrong while generating refresh token")
//     }
// } 
// const generateAccessAndRefreshToken = async(userId) =>{
//     try {
//         const user = await User.findById(userId)
//         const accessToken = user.generateAccessToken()
//         const refreshToken = user.generateRefreshToken()

//         user.refreshToken = refreshToken
//         await user.save({ validateBeforeSave: false })

//         return {accessToken, refreshToken}


//     } catch (error) {
//         throw new ApiError(500, "Something went wrong while generating referesh and access token")
//     }
// }
// const registerUser = asyncHandler( async (req,res)=>{
//     const { fullName, email, username, password}=req.body;
//     if(
//         [fullName,email,username,password].some((field)=>field?.trim()==="")
//     ){
//         throw new ApiError(400,"All field are required");
//     }

//     const userExist= await User.findOne({
//         $or:[{username},{email}]
//     })
//     if(userExist){
//         throw new ApiError(409,"User already exists");
//     }

//     const avatarLocalPath= req.files?.avatar[0]?.path;
//     const coverImageLocalPath= req.files?.coverImage[0]?.path;
//     if(!avatarLocalPath){
//         throw new ApiError(400,"avatar field is required")
//     }
//     let coverImageLocalPath;
//     if(req.files && Array.isArray(req.files.coverImage)&&req.files.coverImage.length>0){
//         coverImageLocalPath=req.files.coverImage[0].path
//     }
//     const avatar= await uploadOnCloudinary(avatarLocalPath);
//     const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    

//     if(!avatar){
//          throw new ApiError(400,"avatar field is required")
//     };

//     const user = await User.create({
//         fullName,
//         email,
//         username:username.toLowerCase(),
//         avatar: avatar.url,
//         coverImage: coverImage?.url||"",
//         password,
//     })

//     const createdUser= await User.findById(user._id).select(
//         "-password -refreshToken"
//     )
//     if(!createdUser){
//         throw new ApiError(500,"S0mething goes wrong while registering user")
//     }
//     return res.status(201).json(
//         new ApiResponse(200,createdUser,"User registered Successfully")
//     )
// } )

// const loginUser= asyncHandler(async (req,res)=>{
//     const {email, username, password}=req.body
//     if(!(username||email)){
//         throw new ApiError(400,"Username or email is required")
//     }
//     const user= await User.findOne({
//         $or:[{username},{email}]
//     })

//     if(!user){
//         throw new ApiError(404,"User does not exist")
//     }

//     const validPassword= await user.isPasswordCorrect(password)
//     if(!validPassword){
//         throw new ApiError(401, "Invalid Password")
//     }
//     const {accessToken, refreshToken}= generateAccessAndRefreshToken(user._id)

//     const loggedIn = await User.findById(user._id)
//     const options ={
//         httpOnly:true,
//         secure:true
//     }
//     return res.status(200)
//     .cookie("accessToken",accessToken,options)
//     .cookie("refreshToken",refreshToken,options)
//     .json(
//         new ApiResponse(
//             200,
//             {
//                 user : loggedIn, accessToken,refreshToken

//             },
//             "User logged in Successfully"
//         )
//     )


// })

// const logoutUser= asyncHandler(async(req,res)=>{
//     await User.findByIdAndUpdate(
//         req.user._id,
//         {
//             $unset:{
//                 refreshToken: 1
//             }
//         },
//         {
//             new:true
//         }
//     ) 

//     const options ={
//         httpOnly:true,
//         secure:true
//     }

//     return res.status(200).clearCookie("accessToken",options)
//     .clearCookie("refreshToken",options)
//     .json(200, {},"User logged out")
// })


// const logoutUser = asyncHandler(async(req, res) => {
//     await User.findByIdAndUpdate(
//         req.user._id,
//         {
//             $unset: {
//                 refreshToken: 1 // this removes the field from document
//             }
//         },
//         {
//             new: true
//         }
//     )

//     const options = {
//         httpOnly: true,
//         secure: true
//     }

//     return res
//     .status(200)
//     .clearCookie("accessToken", options)
//     .clearCookie("refreshToken", options)
//     .json(new ApiResponse(200, {}, "User logged Out"))
// })


// export {registerUser,loginUser,logoutUser}