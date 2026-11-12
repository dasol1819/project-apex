// CC BY 4.0 source model by Tim Samedov. Fit the existing linear radial morph,
// not a measured aircraft envelope or a hydraulic-stop specification.
#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <string>
int main(int argc,char** argv){
 try{
  if(argc!=2)throw std::runtime_error("usage: fit-mig23-nozzle-bounds vertices.csv");
  std::ifstream in(argv[1]);if(!in)throw std::runtime_error("cannot open samples");
  std::string line;std::getline(in,line);if(line!="opening,x,y,z")throw std::runtime_error("unexpected CSV header");
  using V=std::array<double,3>;V low,high,openLow,openHigh;
  low.fill(std::numeric_limits<double>::infinity());openLow=low;high.fill(-low[0]);openHigh=high;
  std::array<int,3> counts{};
  while(std::getline(in,line)){
   std::replace(line.begin(),line.end(),',',' ');std::istringstream row(line);double opening;V p;
   if(!(row>>opening>>p[0]>>p[1]>>p[2]))throw std::runtime_error("invalid vertex row");
   const int state=opening==0?0:opening==.5?1:opening==1?2:-1;
   if(state<0)throw std::runtime_error("expected dry, midpoint or wet endpoint");
   ++counts[state];for(int k=0;k<3;++k){if(!std::isfinite(p[k]))throw std::runtime_error("nonfinite vertex");low[k]=std::min(low[k],p[k]);high[k]=std::max(high[k],p[k]);if(state==2){openLow[k]=std::min(openLow[k],p[k]);openHigh[k]=std::max(openHigh[k],p[k]);}}
  }
  if(counts[0]<3||counts[0]!=counts[1]||counts[0]!=counts[2])throw std::runtime_error("incomplete paired morph samples");
  V pivot,half;for(int k=0;k<3;++k){pivot[k]=(openLow[k]+openHigh[k])*.5;half[k]=std::max(high[k]-pivot[k],pivot[k]-low[k])+.002;}
  auto vector=[](const V& v){std::cout<<'['<<v[0]<<','<<v[1]<<','<<v[2]<<']';};
  std::cout<<std::setprecision(14)<<"{\n  \"part\": 22,\n  \"pivot\": ";vector(pivot);std::cout<<",\n  \"half\": ";vector(half);
  std::cout<<",\n  \"verticesPerPose\": "<<counts[0]<<",\n  \"scope\": \"Current source-model linear nozzle morph opening 0..1; endpoint envelope plus 2 mm numerical padding, not aircraft measurement or certified stops\"\n}\n";
 }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
