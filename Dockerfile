FROM node:18-alpine

WORKDIR /app

COPY . .

RUN npm install
RUN npm install npm-run-all -g

ENV NODE_ENV=production
ENV NEXT_PUBLIC_SOCKET_URL=http://ec2-18-141-212-130.ap-southeast-1.compute.amazonaws.com:4001

EXPOSE 3000
EXPOSE 4001