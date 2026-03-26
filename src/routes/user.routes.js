import { Router } from "express";
import { loginUser ,registerUser, logoutUser,refreshAccessToken,changeCurrentPassword,getCurrentUser,updateDetails,updateAvatar, updateCoverImage, getUserChannelProfile,getWatchHistory } from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import { verify } from "jsonwebtoken";
const router= Router()

router.route('/register').post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser
)

router.route('/login').post(loginUser)
router.route('/logout').post(verifyJWT, logoutUser)
router.route('/refresh-token').post(refreshAccessToken)
router.route('/change-password').post(verifyJWT,changeCurrentPassword)
router.route('/current-user').post(verifyJWT,getCurrentUser)
router.route('/update-details').patch(verifyJWT,updateDetails)
router.route('/update-avatar').patch(verifyJWT,upload.single('/avatar'),updateAvatar)
router.route('/update-cover-image').patch(verifyJWT,upload.single('/coverImage'),updateCoverImage)
router.route('/c/:username').get(verifyJWT,getUserChannelProfile)
router.route('/watch-history').get(verifyJWT,getWatchHistory)

export default router