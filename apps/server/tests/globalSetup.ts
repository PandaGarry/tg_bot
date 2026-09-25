import { makeSetup } from "../../../tools/devdb/globalSetup.js";

/** У пакета своя база: прогон сносит схему, общей быть не может. */
export default makeSetup("server");
