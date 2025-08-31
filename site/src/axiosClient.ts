import axios from "axios";

const client = axios.create({
    headers:{
        "Authorization": localStorage.getItem("token"),
    },
    baseURL: "https://reimagined-space-parakeet-7rv4xq9wg55fr6x7-8080.app.github.dev"
})
export default client