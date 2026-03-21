import dotenv from "dotenv"
import mongoose from "mongoose";
// import {DB_NAME} from "./constants";
// import express from "express"
import connectDB from "./db/index.js"

dotenv.config({
    path: "./env"
})
connectDB(()=>{
    app.listen(process.env.port||8000,()=>{
        console.log(`Server is running at ${process.env.port}`)
    })
})
// .then
.catch((err)=>{
    console.log("Mongo DB connection failed error",err);
    
})

// const app = express()













/*
;(async()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log("ERROR: ", error)
            throw error
        })
        app.listen(process.env.PORT, ()=>{
            console.log(`App is listening at port ${process.env.PORT}`)
        })
    } catch (error) {
        console.error("ERROR: ",error)
        throw error
    }
})()
    */