const NAME = "healthz";
const DESCRIPTION = "Check the health of the server";
const healthz = (extra) => {
    return {
        content: [
            {
                type: "text",
                text: "ok health!",
            },
        ],
    };
};
export default {
    name: NAME,
    description: DESCRIPTION,
    callback: healthz,
};
