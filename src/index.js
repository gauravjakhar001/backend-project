// require('dotenv').config({path: './env'})

import dotenv from "dotenv"
import connectDB from './db/index.js';
import {app} from './app.js'

dotenv.config({
    path: './env'
})


//jb bhi asynchronously method jb bhi complete hota hai to 
// vo hme promise return krta hai 
// to hm yha opr .then and .catch ka use kr skte hai 

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is runing at port : ${process.env.PORT}`)
    })

})
.catch((err)=>{
    console.log("MONGO db Connection failed!!",err)

})

 











/*
import express from "express"
const app = express()

(async ()=>{
    try{
       await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",()=>{
            console.log("ERROR:",error)
            throw error
        })
        app.listen(process.env.PORT,()=>{
            console.log(`App is listening on Port ${process.env.PORT}`)
        })
    }catch(error){
        console.error("ERROR:",error);
        throw error
        
    }
})
*/