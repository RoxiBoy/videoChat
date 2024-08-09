To run this app 
1) Edit the server address in both server.ja and script.js. To run this app on different devices hosting from your own machine use your ip_address:port_number,
   or to just run it in your local machine use localhost:port_number
2) Run npm i
3) Run these 2 commands to create ssl create ssl certificates for a https server (note: make sure to have mkcert installed by running npm i mkcert -g)
   i) mkcert create-ca
   ii) mkcert create-cert
4) Just run the server
