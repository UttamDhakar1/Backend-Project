import mongoose from "mongoose";
import { User } from "./user.models.js";
const subscriptionSchema= new mongoose.Schema(
    {
        subscriber:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        },
        channels:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }
    }
    ,{
    timestamps:true
})

export const subscription= mongoose.model("subscription",subscriptionSchema)