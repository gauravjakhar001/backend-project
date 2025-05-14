class ApiError extends Error {

    constructor(
        statuscCode,
        message = "Something went wrong",
        errors = [],
        stack = ""

    ) {
        super(message)
        this.statuscCode = statuscCode
        this.data = null 
        this.message  = message
        this.success = false
        this.errors = errors

        if(stack){
            this.stack  = stack
        }else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export { ApiError } ;