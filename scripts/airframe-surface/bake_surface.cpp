// SPDX-License-Identifier: GPL-2.0-only
// Rasterize authored metre-scale surface relief to the unchanged airframe UVs.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <vector>
#include "surface_layout.h"
struct V {float x,y,z;V operator+(V b)const{return{x+b.x,y+b.y,z+b.z};}V operator-(V b)const{return{x-b.x,y-b.y,z-b.z};}V operator*(float s)const{return{x*s,y*s,z*s};}};
float dot(V a,V b){return a.x*b.x+a.y*b.y+a.z*b.z;}V cross(V a,V b){return{a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};}V unit(V a){return a*(1.f/std::sqrt(std::max(1.e-15f,dot(a,a))));}
float smooth(float a,float b,float v){float x=std::clamp((v-a)/(b-a),0.f,1.f);return x*x*(3-2*x);}
struct Field{float height,rough,cavity;};
Field surface(V p,V normal){
 if(p.z<RADOME_Z)return{0,.70f,1.f};
 int plane=0;float x=std::abs(p.x),y=p.z;
 if(std::abs(normal.y)<std::max(std::abs(normal.x),std::abs(normal.z))&&std::abs(p.x)<SIDE_MAX_X){plane=2;x=p.z;y=p.y;}
 if(p.y>FIN_MIN_Y&&p.z>FIN_MIN_Z&&std::abs(p.x)>FIN_MIN_X&&std::abs(p.x)<FIN_MAX_X){plane=3;x=p.z;y=p.y;}
 else if(plane==0&&p.y<BOTTOM_Y)plane=1;
 float dist=100.f,along=0;
 for(const auto& l:LINES){if(l.plane!=plane)continue;float dx=l.bx-l.ax,dy=l.by-l.ay,len=std::sqrt(dx*dx+dy*dy),t=std::clamp(((x-l.ax)*dx+(y-l.ay)*dy)/(len*len),0.f,1.f);float d=std::hypot(x-l.ax-dx*t,y-l.ay-dy*t);if(d<dist){dist=d;along=t*len;}}
 for(const auto& h:HATCHES){if(h.plane!=plane)continue;float qx=std::abs(x-h.x)-h.rx+.035f,qy=std::abs(y-h.y)-h.ry+.035f;float d=std::abs(std::hypot(std::max(0.f,qx),std::max(0.f,qy))+std::min(0.f,std::max(qx,qy))-.035f);if(d<dist){dist=d;along=(x-h.x)*.707f+(y-h.y)*.707f;}}
 float row=dist-.015f,phase=along/RIVET_PITCH;float step=(phase-std::floor(phase+.5f))*RIVET_PITCH;float rr=row*row+step*step;
 float seam=std::exp(-dist*dist/(.0032f*.0032f)),rivet=std::exp(-rr/(.0032f*.0032f));
 float shoulder=std::exp(-dist*dist/(.025f*.025f));
 float broad=.5f+.5f*std::sin(p.x*12.4f+std::sin(p.z*1.8f))*std::sin(p.z*7.7f+p.y*3.1f);
 float streak=std::exp(-dist*dist/(.045f*.045f))*(.5f+.5f*std::sin(p.z*15.f+p.x*10.f));
 float height=-.00020f*seam-.000115f*rivet+.000017f*shoulder+.000012f*std::sin(p.x*16.f+p.z*3.f)*std::sin(p.z*12.3f);
 float rough=.65f+.035f*broad+.07f*streak+.055f*seam-.035f*rivet;
 float cavity=1.f-.27f*seam-.15f*rivet-.035f*streak;
 return {height,rough,cavity};
}
struct Vertex{V p,n;float u,v;};
int main(int argc,char**argv){
 if(argc!=4)return 2;int N=std::stoi(argv[3]);std::ifstream f(argv[1],std::ios::binary|std::ios::ate);auto bytes=f.tellg();f.seekg(0);std::vector<Vertex> vs(size_t(bytes)/sizeof(Vertex));f.read((char*)vs.data(),bytes);
 std::vector<uint8_t> out(size_t(N)*N*4,0);size_t covered=0;
 for(size_t j=0;j+2<vs.size();j+=3){auto a=vs[j],b=vs[j+1],c=vs[j+2];float ux=b.u-a.u,vx=b.v-a.v,uy=c.u-a.u,vy=c.v-a.v,det=ux*vy-uy*vx;if(std::abs(det)<1.e-12f)continue;
  V du=((b.p-a.p)*vy-(c.p-a.p)*vx)*(1/det),dv=((c.p-a.p)*ux-(b.p-a.p)*uy)*(1/det);
  int x0=std::max(0,int(std::floor(std::min({a.u,b.u,c.u})*N))),x1=std::min(N-1,int(std::ceil(std::max({a.u,b.u,c.u})*N)));
  int y0=std::max(0,int(std::floor((1-std::max({a.v,b.v,c.v}))*N))),y1=std::min(N-1,int(std::ceil((1-std::min({a.v,b.v,c.v}))*N)));
  for(int y=y0;y<=y1;y++)for(int x=x0;x<=x1;x++){
   float u=(x+.5f)/N-a.u,v=1-(y+.5f)/N-a.v,w1=(u*vy-uy*v)/det,w2=(ux*v-u*vx)/det,w0=1-w1-w2;if(std::min({w0,w1,w2})<-.00001f)continue;
   V p=a.p*w0+b.p*w1+c.p*w2,n=unit(a.n*w0+b.n*w1+c.n*w2),t=unit(du-n*dot(n,du)),bt=unit(cross(n,t));if(dot(bt,dv)<0)bt=bt*-1;
   const float eps=.00065f;auto h=surface(p,n);float dx=(surface(p+t*eps,n).height-surface(p-t*eps,n).height)/(2*eps),dy=(surface(p+bt*eps,n).height-surface(p-bt*eps,n).height)/(2*eps);V nn=unit({-dx,-dy,1});
   size_t k=(size_t(y)*N+x)*4;if(!out[k+3])covered++;out[k]=uint8_t(std::clamp((nn.x*.5f+.5f)*255,0.f,255.f)+.5f);out[k+1]=uint8_t(std::clamp((nn.y*.5f+.5f)*255,0.f,255.f)+.5f);out[k+2]=uint8_t(h.rough*255+.5f);out[k+3]=uint8_t(h.cavity*255+.5f);
  }
 }
 std::ofstream o(argv[2],std::ios::binary);o.write((char*)out.data(),out.size());std::cout<<"BAKED "<<covered<<" texels from "<<vs.size()/3<<" triangles\n";
}
