import 'dotenv/config';
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
});

async function main() {
    try {
        const data = await pinata.gateways.public.get("bafkreiced6b6bsedmvyam2tdpzl3ydfjfbjv4ufjkkuuxdbrbzela662cu");
        console.log(data)

        // const url = await pinata.gateways.convert(
        //     "bafkreib4pqtikzdjlj4zigobmd63lig7u6oxlug24snlr6atjlmlza45dq"
        // )
        // console.log(url)
    } catch (error) {
        console.log(error);
    }
}

main();