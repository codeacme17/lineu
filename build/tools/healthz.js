const healthz = (extra) => {
    return {
        content: [
            {
                type: "text",
                text: "ok",
            },
        ],
    };
};
export default healthz;
