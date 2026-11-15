// Original Tim Samedov geometry, CC BY4.0. Fit the authored welded flap pin,
// not a surveyed aircraft hinge. Preserve source vertices and texture data.
#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
using V=std::array<double,3>;
using P=std::array<double,2>;
V sub(V a,V b){for(int k=0;k<3;k++)a[k]-=b[k];return a;}
V add(V a,V b){for(int k=0;k<3;k++)a[k]+=b[k];return a;}
V scale(V a,double t){for(double& x:a)x*=t;return a;}
double dot(V a,V b){double v=0;for(int k=0;k<3;k++)v+=a[k]*b[k];return v;}
V cross(V a,V b){return {a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]};}
double norm(V a){return std::sqrt(dot(a,a));}
double turn(P a,P b,P c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
struct Flap {std::vector<V> fixed,skin;V wing{};bool hasWing=false;};
void vec(V p){std::cout<<'['<<p[0]<<','<<p[1]<<','<<p[2]<<']';}
int main(int argc,char** argv)try{
 if(argc!=2)throw std::runtime_error("usage: fit-mig23-flaps source.csv");
 std::ifstream in(argv[1]);if(!in)throw std::runtime_error("source unavailable");
 std::string line;std::getline(in,line);if(line!="part,kind,node,x,y,z")throw std::runtime_error("source header changed");
 std::map<int,Flap> parts;
 while(std::getline(in,line)){
  std::replace(line.begin(),line.end(),',',' ');std::istringstream row(line);int part,kind;std::string node;V p;
  if(!(row>>part>>kind>>node>>p[0]>>p[1]>>p[2])||(part!=16&&part!=17)||kind<0||kind>2)throw std::runtime_error("invalid source record");
  for(double x:p)if(!std::isfinite(x))throw std::runtime_error("nonfinite source");
  auto& f=parts[part];
  if(kind==2){if(f.hasWing)throw std::runtime_error("duplicate wing pin");f.wing=p;f.hasWing=true;}
  else (kind==1?f.skin:f.fixed).push_back(p);
 }
 if(parts.size()!=2)throw std::runtime_error("missing flap");
 std::cout<<std::setprecision(17)<<"{\n  \"sourceSha256\":\"eb1d5b3ea7a370e157b89061ade52eaa4e7536ce927852124e40bde94679d4b8\",\n"
 <<"  \"source\":\"Tim Samedov (citizensnip), CC BY4.0\",\n  \"referenceSweepDegrees\":72,\n  \"paddingMetres\":0.002,\n"
 <<"  \"flapRangeDegrees\":[0,25],\n  \"angularEnvelopeStepDegrees\":1,\n"
 <<"  \"scope\":\"Authored source welded hinge and conservative native0..25deg game-actuator envelope; not surveyed geometry or actual MLD deployment limits\",\n  \"parts\":{\n";
 bool first=true;
 for(const auto& [part,f]:parts){
  if(!f.hasWing||f.skin.size()<200||f.fixed.empty())throw std::runtime_error("incomplete flap source");
  std::vector<V> shared;
  for(V p:f.skin){bool welded=false,duplicate=false;
   for(V q:f.fixed)if(norm(sub(p,q))<.00003){welded=true;break;}
   for(V q:shared)if(norm(sub(p,q))<.00003){duplicate=true;break;}
   if(welded&&!duplicate)shared.push_back(p);
  }
  std::size_t support=0;double bestLength=0;V pin{},axis{};
  for(std::size_t i=0;i<shared.size();i++)for(std::size_t j=i+1;j<shared.size();j++){
   V u=sub(shared[j],shared[i]);double length=norm(u);if(length<.1)continue;u=scale(u,1/length);
   std::size_t count=0;double lo=1e9,hi=-1e9;
   for(V p:shared)if(norm(cross(sub(p,shared[i]),u))<.0002){count++;double t=dot(sub(p,shared[i]),u);lo=std::min(lo,t);hi=std::max(hi,t);}
   if(count>support||(count==support&&hi-lo>bestLength)){
    support=count;bestLength=hi-lo;pin=add(shared[i],scale(u,lo));axis=u;
    if(axis[2]<0){pin=add(pin,scale(axis,bestLength));axis=scale(axis,-1);}
   }
  }
  if(support!=8||bestLength<5||bestLength>5.2)throw std::runtime_error("authored welded hinge changed; review source");
  double residual=0,radius=0;
  for(V p:shared){double d=norm(cross(sub(p,pin),axis));if(d<.0002)residual=std::max(residual,d);}
  for(V p:f.skin)radius=std::max(radius,norm(cross(sub(p,pin),axis)));
  const double sign=part==16?-1:1,pi=std::acos(-1.0);std::vector<P> points;double minY=1e9,maxY=-1e9;
  for(int degree=0;degree<=25;degree++){
   double angle=sign*degree*pi/180,c=std::cos(angle),s=std::sin(angle);
   for(V p:f.skin){V v=sub(p,pin);V rotated=add(pin,add(add(scale(v,c),scale(cross(axis,v),s)),scale(axis,dot(axis,v)*(1-c))));
    points.push_back({rotated[0],rotated[2]});minY=std::min(minY,rotated[1]);maxY=std::max(maxY,rotated[1]);
   }
  }
  const double sagitta=radius*(1-std::cos(pi/360));if(sagitta>.0001)throw std::runtime_error("flap envelope sampling too coarse");
  std::sort(points.begin(),points.end());points.erase(std::unique(points.begin(),points.end()),points.end());std::vector<P> hull;
  for(P p:points){while(hull.size()>1&&turn(hull[hull.size()-2],hull.back(),p)<=0)hull.pop_back();hull.push_back(p);}
  auto lower=hull.size();for(auto i=points.rbegin()+1;i!=points.rend();++i){while(hull.size()>lower&&turn(hull[hull.size()-2],hull.back(),*i)<=0)hull.pop_back();hull.push_back(*i);}hull.pop_back();
  if(!first)std::cout<<",\n";
  first=false;
  std::cout<<"    \""<<part<<"\":{\"nodes\":[\""<<(part==16?"OBJ0260\",\"OBJ0270":"OBJ0267\",\"OBJ0271")<<"\"],\"hingePoint\":";vec(pin);
  std::cout<<",\"hingeAxis\":";vec(axis);std::cout<<",\"flapSign\":"<<sign<<",\"hingeSupportVertices\":"<<support<<",\"maxWeldResidualMetres\":"<<residual;
  std::cout<<",\"envelopeSagittaBoundMetres\":"<<sagitta<<",\"sourceVertices\":"<<f.skin.size()<<",\"triangles\":112,\"mappedMeshes\":6,\"hinge\":";vec(f.wing);
  std::cout<<",\"sign\":"<<(part==16?1:-1)<<",\"minY\":"<<minY<<",\"maxY\":"<<maxY<<",\"hullXZ\":[";
  bool comma=false;for(P p:hull){if(comma)std::cout<<',';comma=true;std::cout<<'['<<p[0]<<','<<p[1]<<']';}std::cout<<"]}";
 }
 std::cout<<"\n  }\n}\n";return 0;
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
