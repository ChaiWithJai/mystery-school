import {relay} from '../../deployment/netlify-relay.mjs';
export default (request) => relay(request, name => Netlify.env.get(name));
