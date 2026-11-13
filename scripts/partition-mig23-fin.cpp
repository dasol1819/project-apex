// Source topology partition; Tim Samedov GLB CC BY 4.0. No triangle is cut.
#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <numeric>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
using V=std::array<double,3>;
struct Tri{int primitive,ordinal,vertices,indices;std::array<V,3> p;};
struct Box{V lo{1e30,1e30,1e30},hi{-1e30,-1e30,-1e30};void add(const V& p){for(int k=0;k<3;k++){lo[k]=std::min(lo[k],p[k]);hi[k]=std::max(hi[k],p[k]);}}};
int main(int argc,char** argv){try{
 if(argc!=2)throw std::runtime_error("usage: partition-mig23-fin triangles.csv");
 std::ifstream in(argv[1]);if(!in)throw std::runtime_error("missing input");std::string line;std::getline(in,line);std::vector<Tri> ts;
 while(std::getline(in,line)){std::replace(line.begin(),line.end(),',',' ');std::istringstream row(line);Tri t{};if(!(row>>t.primitive>>t.ordinal>>t.vertices>>t.indices))throw std::runtime_error("invalid row");for(auto& p:t.p)for(double& x:p)if(!(row>>x)||!std::isfinite(x))throw std::runtime_error("invalid vertex");ts.push_back(t);}
 std::vector<int> parent(ts.size());std::iota(parent.begin(),parent.end(),0);auto find=[&](int x){while(parent[x]!=x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
 std::map<std::array<long long,3>,int> weld;
 for(int i=0;i<int(ts.size());i++)if(ts[i].primitive>=0)for(const auto& p:ts[i].p){std::array<long long,3> key{};for(int k=0;k<3;k++)key[k]=std::llround(p[k]*1e5);auto [it,fresh]=weld.emplace(key,i);if(!fresh)parent[find(i)]=find(it->second);}
 std::map<int,std::vector<int>> components;for(int i=0;i<int(ts.size());i++)if(ts[i].primitive>=0)components[find(i)].push_back(i);
 std::vector<int> selected;int componentCount=0;
 for(const auto& [id,list]:components){(void)id;Box box;for(int i:list)for(const auto& p:ts[i].p)box.add(p);
  // Disjoint centreline fin, root fairing and its small hinge/tip fittings.
  // This source-specific classification never clips or stretches a triangle.
  if(box.hi[1]>1.5&&box.lo[2]>2.5&&box.lo[0]>-.2&&box.hi[0]<.2){componentCount++;selected.insert(selected.end(),list.begin(),list.end());}}
 if(selected.size()!=673||componentCount!=7)throw std::runtime_error("source fin topology changed; review before updating");
 Box box;std::map<int,std::vector<int>> ordinals;std::map<int,std::pair<int,int>> sizes;int extras=0;
 for(int i:selected){const auto& t=ts[i];ordinals[t.primitive].push_back(t.ordinal);sizes[t.primitive]={t.vertices,t.indices};for(const auto& p:t.p)box.add(p);}
 for(const auto& t:ts)if(t.primitive<0){extras++;for(const auto& p:t.p)box.add(p);}
 if(extras!=299)throw std::runtime_error("fin root/hinge fitting topology changed");
 V pivot,half;for(int k=0;k<3;k++){pivot[k]=(box.lo[k]+box.hi[k])*.5;half[k]=(box.hi[k]-box.lo[k])*.5+.002;}
 auto vector=[](const V& v){std::cout<<'['<<v[0]<<','<<v[1]<<','<<v[2]<<']';};
 std::cout<<std::setprecision(14)<<"{\n  \"sourceSha256\": \"eb1d5b3ea7a370e157b89061ade52eaa4e7536ce927852124e40bde94679d4b8\",\n  \"node\": \"mig23mld_fuz\",\n  \"weldQuantumMetres\": 0.00001,\n  \"components\": "<<componentCount<<",\n  \"sourceTriangles\": 673,\n  \"attachmentTriangles\": "<<extras<<",\n  \"attachments\": [\"OBJ0010\",\"OBJ0011\",\"OBJ0012\",\"OBJ0017\"],\n  \"primitives\": [";
 bool first=true;for(auto& [primitive,list]:ordinals){std::sort(list.begin(),list.end());if(!first)std::cout<<',';first=false;std::cout<<"{\"primitive\":"<<primitive<<",\"vertexCount\":"<<sizes[primitive].first<<",\"indexCount\":"<<sizes[primitive].second<<",\"triangles\":[";for(size_t i=0;i<list.size();i++){if(i)std::cout<<',';std::cout<<list[i];}std::cout<<"]}";}
 std::cout<<"],\n  \"nativeShape\": {\"part\":5,\"pivot\":";vector(pivot);std::cout<<",\"half\":";vector(half);std::cout<<"},\n  \"scope\": \"Unchanged original source components; 10 micrometre weld quantization and 2 mm numeric pad are not aircraft measurement tolerances or a physical mass centre\"\n}\n";
}catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}}
